import { createServiceClient } from "@/lib/supabase/service";
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
} as const;

export type NotificationSourceKind =
  (typeof NOTIFICATION_SOURCE_KINDS)[keyof typeof NOTIFICATION_SOURCE_KINDS];

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
