"use server";

// Kudos server actions (W4 + PR5 multi-category). Split out of the
// 2.4k-line intranet/actions.ts so the kudos logic — create, post-publish
// recipient add, and the notification fan-out — lives in one place.

import { getCurrentUser } from "@/lib/auth";
import {
  createNotifications,
  NOTIFICATION_SOURCE_KINDS,
} from "@/lib/notifications";
import {
  POST_TYPES,
  KUDOS_MESSAGE_MAX_LENGTH,
  KUDOS_MAX_RECIPIENTS,
  validateKudosCategories,
  kudosNotificationTitle,
  type KudosCategory,
} from "@/lib/intranet";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";

interface CreateKudosPostInput {
  message: string;
  categories: string[];
  recipientIds: string[];
}

interface CreateKudosPostResult {
  success: boolean;
  error: string | null;
  postId?: string;
}

/**
 * Create a kudos post. Validates recipient set, message, and the 1-2
 * categories; inserts the post + recipient join rows + per-recipient
 * notifications in a single round-trip flow.
 *
 * Multi-recipient is intentional — kudos can credit a team. Cap is 10
 * (W4 spec). Sender is excluded from recipients (self-kudos is meaningless).
 *
 * Notifications fan out via createNotifications (batch insert) so a
 * 10-recipient kudos is one DB statement, not ten.
 */
export async function createKudosPost(
  data: CreateKudosPostInput,
): Promise<CreateKudosPostResult> {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) return { success: false, error: "Not authenticated" };

  // ─── Validate ────────────────────────────────────────────────
  const message = data.message?.trim();
  if (!message) {
    return { success: false, error: "Add a message to your kudos." };
  }
  if (message.length > KUDOS_MESSAGE_MAX_LENGTH) {
    return {
      success: false,
      error: `Kudos message can be at most ${KUDOS_MESSAGE_MAX_LENGTH} characters.`,
    };
  }
  const categoryCheck = validateKudosCategories(data.categories);
  if (!categoryCheck.ok) {
    return { success: false, error: categoryCheck.error };
  }
  const categories = categoryCheck.categories;

  // De-dupe + drop self + verify non-empty
  const recipientIds = Array.from(new Set(data.recipientIds)).filter(
    (id) => id && id !== user.id,
  );
  if (recipientIds.length === 0) {
    return {
      success: false,
      error: "Pick at least one colleague to recognise.",
    };
  }
  if (recipientIds.length > KUDOS_MAX_RECIPIENTS) {
    return {
      success: false,
      error: `Kudos can include up to ${KUDOS_MAX_RECIPIENTS} colleagues — for larger groups, post an announcement.`,
    };
  }

  // ─── Insert post ────────────────────────────────────────────
  const postInsert: Database["public"]["Tables"]["posts"]["Insert"] = {
    author_id: user.id,
    content: message,
    post_type: POST_TYPES.KUDOS,
    kudos_categories: categories,
  };
  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert(postInsert)
    .select("id")
    .single();
  if (postError || !post) {
    logger.error("Failed to insert kudos post", { error: postError });
    return { success: false, error: "Failed to create kudos." };
  }

  // ─── Insert recipients (batch) ──────────────────────────────
  // Wrapped in try/catch because the rollback below is load-bearing.
  // The Supabase client returns `{ error }` for normal DB failures,
  // but a network-layer throw (DNS drop, connection reset) bypasses
  // that channel and the await rejects. Without the try/catch, the
  // post stays in the table with no recipients — exactly the
  // orphan-state the rollback exists to prevent.
  const recipientRows = recipientIds.map((recipient_id) => ({
    post_id: post.id,
    recipient_id,
  }));
  let recipientInsertFailed = false;
  let recipientFailureDetail: unknown = null;
  try {
    const { error: recipientError } = await supabase
      .from("post_kudos_recipients")
      .insert(recipientRows);
    if (recipientError) {
      recipientInsertFailed = true;
      recipientFailureDetail = recipientError;
    }
  } catch (thrown) {
    recipientInsertFailed = true;
    recipientFailureDetail = thrown;
  }
  if (recipientInsertFailed) {
    logger.error("Failed to insert kudos recipients", {
      error: recipientFailureDetail,
    });
    // Best-effort rollback. If the delete itself throws or fails, log
    // and surface a generic error — there's nothing more we can do
    // from server-side at this point. The orphan, if any, can be
    // cleaned up manually via the kudos post's id (returned in the log).
    try {
      await supabase.from("posts").delete().eq("id", post.id);
    } catch (rollbackError) {
      logger.error("Failed to roll back orphaned kudos post", {
        postId: post.id,
        error: rollbackError,
      });
    }
    return { success: false, error: "Failed to create kudos." };
  }

  // ─── Notify recipients ──────────────────────────────────────
  await fanOutKudosNotifications({
    postId: post.id,
    senderName: profile.full_name ?? "A colleague",
    message,
    categories,
    recipientIds,
  });

  revalidatePath("/intranet", "layout");
  return { success: true, error: null, postId: post.id };
}

interface AddKudosRecipientsInput {
  postId: string;
  recipientIds: string[];
}

/**
 * Add recipients to an existing kudos post. Add-only — recipients
 * cannot be removed once published (W4 design call: removing
 * retroactively rewrites who got recognised, which feels wrong).
 *
 * Only the post author can add. Existing recipients are NOT
 * re-notified (notification only fires for personally-relevant
 * changes — Slack-thread pattern).
 */
export async function addKudosRecipients(
  data: AddKudosRecipientsInput,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) return { success: false, error: "Not authenticated" };

  // ─── Authorise + verify post is kudos ────────────────────────
  // Pull `kudos_categories` in the same select so the fan-out below
  // doesn't need a second round-trip for the same row.
  const { data: post, error: postFetchError } = await supabase
    .from("posts")
    .select("id, author_id, post_type, content, kudos_categories")
    .eq("id", data.postId)
    .single();
  if (postFetchError || !post) {
    return { success: false, error: "Kudos post not found." };
  }
  if (post.author_id !== user.id) {
    return { success: false, error: "Only the author can edit a kudos." };
  }
  if (post.post_type !== POST_TYPES.KUDOS) {
    return { success: false, error: "This isn't a kudos post." };
  }

  // ─── Pull existing recipients to compute the delta ──────────
  const { data: existing, error: existingError } = await supabase
    .from("post_kudos_recipients")
    .select("recipient_id")
    .eq("post_id", post.id);
  if (existingError) {
    logger.error("Failed to fetch existing kudos recipients", {
      error: existingError,
    });
    return { success: false, error: "Failed to add recipients." };
  }

  const existingIds = new Set(existing?.map((r) => r.recipient_id) ?? []);
  const newIds = Array.from(new Set(data.recipientIds)).filter(
    (id) => id && id !== user.id && !existingIds.has(id),
  );
  if (newIds.length === 0) {
    return { success: false, error: "No new recipients to add." };
  }
  // Cap check — total (existing + new) ≤ 10
  if (existingIds.size + newIds.length > KUDOS_MAX_RECIPIENTS) {
    return {
      success: false,
      error: `Kudos can include up to ${KUDOS_MAX_RECIPIENTS} colleagues in total.`,
    };
  }

  // Categories were fetched alongside the post. The CHECK constraint
  // guarantees a kudos has 1-2 categories, but fall back to ["Thank you"]
  // defensively if a future migration ever relaxes that.
  const stored = post.kudos_categories as KudosCategory[] | null;
  const categories = stored?.length ? stored : (["Thank you"] as KudosCategory[]);

  // ─── Insert new join rows + fan out notifications ───────────
  const recipientRows = newIds.map((recipient_id) => ({
    post_id: post.id,
    recipient_id,
  }));
  const { error: recipientError } = await supabase
    .from("post_kudos_recipients")
    .insert(recipientRows);
  if (recipientError) {
    logger.error("Failed to add kudos recipients", { error: recipientError });
    return { success: false, error: "Failed to add recipients." };
  }

  await fanOutKudosNotifications({
    postId: post.id,
    senderName: profile.full_name ?? "A colleague",
    message: post.content ?? "",
    categories,
    recipientIds: newIds,
  });

  revalidatePath("/intranet", "layout");
  return { success: true, error: null };
}

/**
 * Internal: fan-out kudos notifications via the batch helper. Each
 * recipient gets a row in `notifications` with the kudos source_kind,
 * the post id as source_id (so dedupe keys work), and metadata
 * carrying the categories for renderer use.
 */
async function fanOutKudosNotifications(args: {
  postId: string;
  senderName: string;
  message: string;
  categories: KudosCategory[];
  recipientIds: string[];
}) {
  const { postId, senderName, message, categories, recipientIds } = args;

  const rows = recipientIds.map((userId) => ({
    userId,
    type: "kudos" as const,
    title: kudosNotificationTitle(senderName, categories),
    // Trim message to a single-line preview; the bell row line-clamps
    // anyway, but a leaner stored body is kinder to other surfaces.
    message: message.length > 200 ? `${message.slice(0, 199)}…` : message,
    link: `/intranet/post/${postId}`,
    metadata: { categories, post_id: postId },
    sourceKind: NOTIFICATION_SOURCE_KINDS.KUDOS,
    sourceId: postId,
  }));

  const { error } = await createNotifications(rows);
  if (error) {
    logger.warn("Failed to fan out kudos notifications", {
      postId,
      recipientCount: recipientIds.length,
      error: error.message,
    });
  }
}
