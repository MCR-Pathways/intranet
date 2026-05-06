import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/database.types";

/**
 * The set of source_kind values used across the platform's notification
 * surfaces. Each value names a category whose notifications can be auto-
 * cleared together when the underlying source record's state resolves.
 */
export const NOTIFICATION_SOURCE_KINDS = {
  LEAVE_REQUEST: "leave_request",
  FLEXIBLE_WORKING_REQUEST: "flexible_working_request",
  FWR_APPEAL: "fwr_appeal",
  RTW_FORM: "rtw_form",
  STAFF_LEAVING_FORM: "staff_leaving_form",
  COURSE_ASSIGNMENT: "course_assignment",
  COURSE_COMPLETION: "course_completion",
  COMPLIANCE_ASSIGNMENT: "compliance_assignment",
  POST_MENTION: "post_mention",
  COMMENT_MENTION: "comment_mention",
  POST_COMMENT: "post_comment",
  COMMENT_REPLY: "comment_reply",
  WEEKLY_ROUNDUP: "weekly_roundup",
  ONBOARDING_STEP: "onboarding_step",
  WORKING_LOCATION: "working_location",
} as const;

export type NotificationSourceKind =
  (typeof NOTIFICATION_SOURCE_KINDS)[keyof typeof NOTIFICATION_SOURCE_KINDS];

/**
 * Source kinds where the user has nothing to do but read the notification.
 * Clicking the row navigates AND clears (engaging with the info IS the
 * intentional act). Distinguished from actionable kinds where clicking
 * only navigates and the user has to do the underlying work to clear.
 */
export const INFORMATIONAL_SOURCE_KINDS = new Set<NotificationSourceKind>([
  NOTIFICATION_SOURCE_KINDS.POST_MENTION,
  NOTIFICATION_SOURCE_KINDS.COMMENT_MENTION,
  NOTIFICATION_SOURCE_KINDS.POST_COMMENT,
  NOTIFICATION_SOURCE_KINDS.COMMENT_REPLY,
  NOTIFICATION_SOURCE_KINDS.COURSE_COMPLETION,
  NOTIFICATION_SOURCE_KINDS.WEEKLY_ROUNDUP,
  NOTIFICATION_SOURCE_KINDS.ONBOARDING_STEP,
]);

/**
 * Human-readable reason-pill labels per source kind. Used by the bell
 * popover and /notifications page to differentiate event-style rows from
 * persistent-state rows at a glance.
 */
export const SOURCE_KIND_REASON_LABEL: Record<NotificationSourceKind, string> = {
  leave_request: "Leave request",
  flexible_working_request: "Flexible working",
  fwr_appeal: "FWR appeal",
  rtw_form: "Return to work",
  staff_leaving_form: "Leaving form",
  course_assignment: "Course assigned",
  course_completion: "Course completed",
  compliance_assignment: "Compliance",
  post_mention: "Mention",
  comment_mention: "Mention",
  post_comment: "Comment",
  comment_reply: "Reply",
  weekly_roundup: "Weekly roundup",
  onboarding_step: "Onboarding",
  working_location: "Working location",
};

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  sourceKind: NotificationSourceKind;
  sourceId: string;
}

/**
 * Create a notification for a user using the service role client.
 * The notifications table has no INSERT RLS policy for regular users,
 * so the service role is required to create notifications.
 */
export async function createNotification(params: CreateNotificationParams) {
  const supabase = createServiceClient();

  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link ?? null,
    metadata: (params.metadata ?? null) as Json,
    source_kind: params.sourceKind,
    source_id: params.sourceId,
  });

  return { error };
}

/**
 * Mark all notifications with the given (source_kind, source_id) as cleared.
 * Called from state-resolution actions: when a manager approves a leave
 * request, all notifications about that request flip to is_cleared = true
 * across every recipient. Idempotent — re-running does no work because the
 * .eq("is_cleared", false) filter excludes already-cleared rows.
 *
 * Service-role client because the recipients of the notifications won't
 * always overlap with the actor (e.g. an HR admin approving on behalf of a
 * manager), so user-RLS would block the cross-user UPDATE.
 *
 * Returns the error if you need to make decisions on it. Prefer
 * `autoClearSource` for fire-and-forget callers (the common case).
 */
export async function markSourceCleared(
  sourceKind: NotificationSourceKind,
  sourceId: string,
) {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("notifications")
    .update({
      is_cleared: true,
      cleared_at: new Date().toISOString(),
    })
    .eq("source_kind", sourceKind)
    .eq("source_id", sourceId)
    .eq("is_cleared", false);

  return { error };
}

/**
 * Fire-and-forget auto-clear: catches both returned errors and thrown
 * exceptions, logs at warn level, never throws or returns. Use this from
 * state-resolution actions where the action's success doesn't depend on
 * the clear succeeding (cron retention sweep would catch any drift).
 */
export async function autoClearSource(
  sourceKind: NotificationSourceKind,
  sourceId: string,
): Promise<void> {
  try {
    const { error } = await markSourceCleared(sourceKind, sourceId);
    if (error) {
      logger.warn("Failed to auto-clear notifications", {
        sourceKind,
        sourceId,
        error: error.message,
      });
    }
  } catch (err) {
    logger.warn("Failed to auto-clear notifications", {
      sourceKind,
      sourceId,
      error: err,
    });
  }
}

/**
 * Batch-create notifications. Same row shape as createNotification; runs as
 * a single insert for one DB round trip. Used by paths that fan out to many
 * users at once (e.g. notify all HR admins of a new flexible working request).
 */
export async function createNotifications(
  rows: CreateNotificationParams[],
) {
  if (rows.length === 0) return { error: null };

  const supabase = createServiceClient();

  const { error } = await supabase.from("notifications").insert(
    rows.map((row) => ({
      user_id: row.userId,
      type: row.type,
      title: row.title,
      message: row.message,
      link: row.link ?? null,
      metadata: (row.metadata ?? null) as Json,
      source_kind: row.sourceKind,
      source_id: row.sourceId,
    })),
  );

  return { error };
}
