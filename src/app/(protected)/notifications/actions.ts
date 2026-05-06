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
 * Internal: fetch + dedup uncleared notifications for a known user. Used
 * by both getNotifications (public action that calls getCurrentUser) and
 * getInboxStream (which already has the user in hand and runs this in
 * parallel with persistent-attention to avoid double auth + sequential
 * waits).
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
 * Fetch the current user's uncleared notifications, deduplicated by
 * (source_kind, source_id) — one row per source record, showing the
 * most recent state.
 *
 * Notifications without a source_id (grandfathered or system-wide) are
 * NOT deduplicated — each stays as its own row.
 */
export async function getNotifications() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { notifications: [], error: "Not authenticated" };
  }

  return fetchUnclearedNotifications(supabase, user.id);
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
    reason: n.source_kind
      ? (SOURCE_KIND_REASON_LABEL[n.source_kind as NotificationSourceKind] ?? "Notification")
      : "Notification",
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

// ─── Legacy is_read actions (kept for the existing popover until W3-rev.2b ships) ───

export async function markNotificationRead(
  notificationId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    logger.error("Failed to mark notification as read", { error });
    return {
      success: false,
      error:
        "Failed to update notification. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
    };
  }

  revalidatePath("/", "layout");
  return { success: true, error: null };
}

export async function markAllNotificationsRead(): Promise<{
  success: boolean;
  error: string | null;
}> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) {
    logger.error("Failed to mark all notifications as read", { error });
    return {
      success: false,
      error:
        "Failed to update notifications. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
    };
  }

  revalidatePath("/", "layout");
  return { success: true, error: null };
}
