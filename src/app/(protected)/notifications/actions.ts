"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { getAllPersistentAttention } from "@/lib/persistent-attention";
import { SOURCE_KIND_REASON_LABEL } from "@/lib/notifications";
import type { NotificationSourceKind } from "@/lib/notifications";
import type { InboxRow } from "@/types/notification";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const NOTIFICATIONS_FETCH_LIMIT = 50; // overfetch to allow JS dedup
const NOTIFICATIONS_RETURN_LIMIT = 20; // shown in popover after dedup

type Client = SupabaseClient<Database>;

/**
 * Internal: fetch + dedup uncleared notifications for a known user.
 * Called from getInboxStream in parallel with persistent-attention.
 */
async function fetchUnclearedNotifications(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, user_id, type, title, message, link, is_read, read_at, created_at, source_kind, source_id, is_cleared, cleared_at",
    )
    .eq("user_id", userId)
    .eq("is_cleared", false)
    .order("created_at", { ascending: false })
    .limit(NOTIFICATIONS_FETCH_LIMIT);

  if (error) {
    logger.error("Failed to fetch notifications", { error });
    return {
      notifications: [],
      error:
        "Failed to fetch notifications. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
    };
  }

  // Dedup by composite (source_kind, source_id) so legacy serial ids
  // from different tables can't collide. Rows without source_id pass
  // through untouched (their own keyspace).
  const seen = new Set<string>();
  const deduped = (data ?? []).filter((row) => {
    const key = row.source_id
      ? `${row.source_kind}:${row.source_id}`
      : `_no_source_${row.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    notifications: deduped.slice(0, NOTIFICATIONS_RETURN_LIMIT),
    error: null,
  };
}

/**
 * Merged inbox stream: DB notifications (deduped, uncleared) + virtual
 * rows computed from underlying state (overdue compliance, pending
 * approvals, etc.). Sorted by created_at descending.
 *
 * Runs the notifications fetch + persistent-attention compute in
 * parallel — the bell is a critical path; sequential waits cost
 * ~50-150ms per render.
 */
export async function getInboxStream(): Promise<{
  rows: InboxRow[];
  error: string | null;
}> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { rows: [], error: "Not authenticated" };
  }

  const [notifResult, stateRows] = await Promise.all([
    fetchUnclearedNotifications(supabase, user.id),
    getAllPersistentAttention(supabase, user.id),
  ]);

  if (notifResult.error) {
    return { rows: [], error: notifResult.error };
  }

  const eventRows: InboxRow[] = notifResult.notifications.map((n) => ({
    id: n.id,
    kind: "event" as const,
    source_kind: n.source_kind,
    source_id: n.source_id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    created_at: n.created_at ?? new Date().toISOString(),
    is_cleared: n.is_cleared ?? false,
    // Empty reason → row renders without a pill. We deliberately do NOT
    // fall back to a generic "Notification" label: a pill that says
    // "Notification" on a notification row is noise, not signal.
    reason: n.source_kind
      ? (SOURCE_KIND_REASON_LABEL[n.source_kind as NotificationSourceKind] ?? "")
      : "",
  }));

  // Merge + sort by created_at desc. State items typically use either an
  // underlying event timestamp (oldest pending request) or "now" — both
  // sort sensibly against event-row created_at values.
  const merged = [...eventRows, ...stateRows].sort((a, b) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
  );

  return { rows: merged, error: null };
}

/**
 * Clear a single notification (the user clicked the X icon, or clicked
 * an informational notification's row). Idempotent — re-clearing a
 * cleared row is a no-op.
 */
export async function clearNotification(
  notificationId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_cleared: true, cleared_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    logger.error("Failed to clear notification", { error });
    return {
      success: false,
      error:
        "Failed to clear notification. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
    };
  }

  revalidatePath("/", "layout");
  return { success: true, error: null };
}

/**
 * Clear every uncleared notification for the current user (Clear all
 * footer button). The bell badge drops to 0 immediately.
 */
export async function clearAllNotifications(): Promise<{
  success: boolean;
  error: string | null;
}> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_cleared: true, cleared_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("is_cleared", false);

  if (error) {
    logger.error("Failed to clear all notifications", { error });
    return {
      success: false,
      error:
        "Failed to clear notifications. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
    };
  }

  revalidatePath("/", "layout");
  return { success: true, error: null };
}

// ─── /notifications page ─────────────────────────────────────────────

const NOTIFICATIONS_PAGE_LIMIT = 500; // hard cap; UI shows a footer if hit.

/**
 * Save (pin) a notification. Sets `is_saved=true` + `saved_at=now()`.
 * Idempotent — re-saving a saved row is a no-op (CHECK constraint
 * keeps `saved_at` aligned).
 */
export async function saveNotification(
  notificationId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_saved: true, saved_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    logger.error("Failed to save notification", { error });
    return {
      success: false,
      error:
        "Failed to save notification. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
    };
  }

  revalidatePath("/notifications", "layout");
  return { success: true, error: null };
}

/**
 * Unsave (un-pin) a notification. Clears both flags so the CHECK
 * constraint stays satisfied.
 */
export async function unsaveNotification(
  notificationId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_saved: false, saved_at: null })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    logger.error("Failed to unsave notification", { error });
    return {
      success: false,
      error:
        "Failed to unsave notification. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
    };
  }

  revalidatePath("/notifications", "layout");
  return { success: true, error: null };
}

/**
 * Restore a cleared notification back to Inbox. Used on the Cleared
 * tab's per-row Restore action. is_saved is left untouched.
 */
export async function restoreNotification(
  notificationId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_cleared: false, cleared_at: null })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    logger.error("Failed to restore notification", { error });
    return {
      success: false,
      error:
        "Failed to restore notification. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
    };
  }

  revalidatePath("/notifications", "layout");
  return { success: true, error: null };
}

export type NotificationTab = "inbox" | "saved" | "cleared";

/**
 * Fetch rows for one tab on /notifications, plus the row counts for the
 * other two tabs (so the tab strip can render `Inbox (5) / Saved (12)
 * / Cleared (47)` without a per-tab roundtrip).
 *
 * Inbox merges DB events with persistent-state rows (mirroring
 * getInboxStream). Saved and Cleared are event-rows only — state rows
 * have no DB id to pin or clear.
 */
export async function getNotificationsByTab(tab: NotificationTab): Promise<{
  rows: InboxRow[];
  counts: {
    inbox: number;
    saved: number;
    cleared: number;
    /** DB-only Inbox count (no state rows). Drives "Clear all" — state rows can't be cleared. */
    inboxClearable: number;
  };
  truncated: boolean;
  error: string | null;
}> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return {
      rows: [],
      counts: { inbox: 0, saved: 0, cleared: 0, inboxClearable: 0 },
      truncated: false,
      error: "Not authenticated",
    };
  }

  // Counts are cheap server-side and let the tab strip render correctly
  // on the first paint. Run them in parallel with the data fetch.
  const countSelect = "id";

  const inboxCountQ = supabase
    .from("notifications")
    .select(countSelect, { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_cleared", false);
  const savedCountQ = supabase
    .from("notifications")
    .select(countSelect, { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_saved", true);
  const clearedCountQ = supabase
    .from("notifications")
    .select(countSelect, { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_cleared", true);

  const dataQ = (() => {
    const baseSelect =
      "id, user_id, type, title, message, link, is_read, read_at, created_at, source_kind, source_id, is_cleared, cleared_at, is_saved, saved_at";

    if (tab === "inbox") {
      return supabase
        .from("notifications")
        .select(baseSelect)
        .eq("user_id", user.id)
        .eq("is_cleared", false)
        .order("created_at", { ascending: false })
        .limit(NOTIFICATIONS_PAGE_LIMIT);
    }
    if (tab === "saved") {
      return supabase
        .from("notifications")
        .select(baseSelect)
        .eq("user_id", user.id)
        .eq("is_saved", true)
        .order("saved_at", { ascending: false })
        .limit(NOTIFICATIONS_PAGE_LIMIT);
    }
    // tab === "cleared"
    return supabase
      .from("notifications")
      .select(baseSelect)
      .eq("user_id", user.id)
      .eq("is_cleared", true)
      .order("cleared_at", { ascending: false })
      .limit(NOTIFICATIONS_PAGE_LIMIT);
  })();

  // State rows compute from underlying tables (working_location,
  // leave_requests, compliance_documents, absence_records). Always
  // computed — Inbox tab merges them into the row list AND the Inbox
  // tab count includes them, regardless of which tab the user is on.
  // Without this, "Inbox (0)" can show next to a tab that visibly
  // contains a state row, which confuses everyone.
  const persistentQ = getAllPersistentAttention(supabase, user.id);

  const [inboxCountRes, savedCountRes, clearedCountRes, dataRes, stateRows] =
    await Promise.all([
      inboxCountQ,
      savedCountQ,
      clearedCountQ,
      dataQ,
      persistentQ,
    ]);

  if (dataRes.error) {
    logger.error("Failed to fetch /notifications data", {
      tab,
      error: dataRes.error,
    });
    return {
      rows: [],
      counts: { inbox: 0, saved: 0, cleared: 0, inboxClearable: 0 },
      truncated: false,
      error:
        "Failed to fetch notifications. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
    };
  }

  // Count queries are independent; log per-query errors so a silent
  // null doesn't show "Inbox 0" next to a populated row list. We don't
  // bail the whole render on a count failure — degraded counts beat a
  // blank page.
  if (inboxCountRes.error) {
    logger.warn("Inbox count query failed", { error: inboxCountRes.error });
  }
  if (savedCountRes.error) {
    logger.warn("Saved count query failed", { error: savedCountRes.error });
  }
  if (clearedCountRes.error) {
    logger.warn("Cleared count query failed", { error: clearedCountRes.error });
  }

  const data = dataRes.data ?? [];

  // Same dedup as the bell — composite (source_kind, source_id) so
  // older serial ids from different tables can't collide.
  const seen = new Set<string>();
  const deduped = data.filter((row) => {
    const key = row.source_id
      ? `${row.source_kind}:${row.source_id}`
      : `_no_source_${row.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const eventRows: InboxRow[] = deduped.map((n) => ({
    id: n.id,
    kind: "event" as const,
    source_kind: n.source_kind,
    source_id: n.source_id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    created_at: n.created_at ?? new Date().toISOString(),
    is_cleared: n.is_cleared ?? false,
    is_saved: n.is_saved ?? false,
    saved_at: n.saved_at,
    cleared_at: n.cleared_at,
    reason: n.source_kind
      ? (SOURCE_KIND_REASON_LABEL[n.source_kind as NotificationSourceKind] ?? "")
      : "",
  }));

  // Merge state rows on Inbox only; sort by the tab's primary timestamp.
  let rows: InboxRow[];
  if (tab === "inbox") {
    rows = [...eventRows, ...stateRows].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  } else {
    // Already sorted by saved_at / cleared_at via the query.
    rows = eventRows;
  }

  return {
    rows,
    counts: {
      // State rows live in Inbox only (Path A), so add them to the
      // inbox count for consistency with the rendered row list.
      inbox: (inboxCountRes.count ?? 0) + stateRows.length,
      saved: savedCountRes.count ?? 0,
      cleared: clearedCountRes.count ?? 0,
      // Clear-all only flips DB rows; state rows have no DB id.
      // The dialog count and the kebab visibility both key off this
      // so we never advertise clearing what we can't clear.
      inboxClearable: inboxCountRes.count ?? 0,
    },
    truncated: data.length >= NOTIFICATIONS_PAGE_LIMIT,
    error: null,
  };
}
