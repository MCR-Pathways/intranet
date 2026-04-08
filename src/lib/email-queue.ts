/**
 * Email sending and audit utilities for the platform-wide notification system.
 *
 * Action-triggered emails send immediately via Resend and log to
 * `email_notifications` as an audit trail. The daily-reminders cron
 * also sends directly. A retry cron picks up failed sends.
 *
 * Server-only — uses service role client to bypass RLS.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

// ─── Email Type Configuration ────────────────────────────────────────────────

/** Mandatory emails are always sent regardless of user preferences. */
const MANDATORY_EMAIL_TYPES = new Set([
  "course_assigned",
  "course_overdue_digest",
  "course_overdue_manager",
  "compliance_expiry",
  "leave_decision",
  "stale_leave_reminder",
  "welcome",
]);

/** All valid email types for the platform. */
export const EMAIL_TYPES = {
  // L&D
  course_assigned: { label: "Course assigned", module: "Learning", mandatory: true },
  course_overdue_digest: { label: "Overdue course reminders", module: "Learning", mandatory: true },
  course_overdue_manager: { label: "Team overdue courses (managers)", module: "Learning", mandatory: true },
  certificate_earned: { label: "Certificate earned", module: "Learning", mandatory: false },
  course_completed: { label: "Course completed", module: "Learning", mandatory: false },
  // HR
  compliance_expiry: { label: "Compliance document expiry", module: "HR", mandatory: true },
  key_date_reminder: { label: "Key date reminders", module: "HR", mandatory: false },
  leave_decision: { label: "Leave request decisions", module: "HR", mandatory: true },
  stale_leave_reminder: { label: "Stale leave request reminders", module: "HR", mandatory: true },
  // Intranet
  mention: { label: "Mentions in posts and comments", module: "Intranet", mandatory: false },
  // System
  welcome: { label: "Welcome email", module: "System", mandatory: true },
} as const;

export type EmailType = keyof typeof EMAIL_TYPES;

// ─── Preference Check ────────────────────────────────────────────────────────

/**
 * Check if an email type is enabled for a user.
 * Mandatory types always return true.
 * Optional types default to true unless explicitly disabled.
 */
export async function isEmailEnabled(
  userId: string,
  emailType: string
): Promise<boolean> {
  // Mandatory emails always send
  if (MANDATORY_EMAIL_TYPES.has(emailType)) {
    return true;
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("email_preferences")
    .select("enabled")
    .eq("user_id", userId)
    .eq("email_type", emailType)
    .single();

  // Default to enabled if no preference exists
  return data?.enabled ?? true;
}

// ─── Queue Email ─────────────────────────────────────────────────────────────

interface QueueEmailParams {
  userId: string;
  email: string;
  emailType: string;
  subject: string;
  bodyHtml: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Queue an email for sending by the Cron processor.
 *
 * - Checks user preferences (skipped for mandatory types)
 * - Handles dedup gracefully (23505 conflict → already queued)
 * - Returns { success, queued, error }
 */
export async function queueEmail(
  params: QueueEmailParams
): Promise<{ success: boolean; queued: boolean; error?: string }> {
  // Check preferences for optional types
  const enabled = await isEmailEnabled(params.userId, params.emailType);
  if (!enabled) {
    return { success: true, queued: false };
  }

  const supabase = createServiceClient();

  const { error } = await supabase.from("email_notifications").insert({
    user_id: params.userId,
    email_type: params.emailType,
    subject: params.subject,
    body_html: params.bodyHtml,
    entity_id: params.entityId ?? null,
    entity_type: params.entityType ?? null,
    metadata: {
      ...params.metadata,
      recipient_email: params.email,
    },
    status: "pending",
  });

  if (error) {
    // Dedup conflict — email already queued for this user+type+entity
    if (error.code === "23505") {
      return { success: true, queued: false };
    }

    logger.error("Failed to queue email", {
      emailType: params.emailType,
      userId: params.userId,
      error: error.message,
    });
    return { success: false, queued: false, error: error.message };
  }

  return { success: true, queued: true };
}

// ─── Send Email Immediately ─────────────────────────────────────────────────

/**
 * Send an email immediately via Resend and log the result to
 * `email_notifications` as an audit trail.
 *
 * - Checks user preferences (skipped for mandatory types)
 * - Sends via Resend API directly (no queue delay)
 * - Logs to email_notifications with status "sent" or "failed"
 * - If the DB insert fails after a successful send, logs a warning
 *   but returns success (the email was delivered)
 */
export async function sendAndLogEmail(
  params: QueueEmailParams
): Promise<{ success: boolean; sent: boolean; error?: string }> {
  const enabled = await isEmailEnabled(params.userId, params.emailType);
  if (!enabled) {
    return { success: true, sent: false };
  }

  const result = await sendEmail(params.email, params.subject, params.bodyHtml);

  // Log to email_notifications as audit trail
  const supabase = createServiceClient();
  const { error: insertError } = await supabase.from("email_notifications").insert({
    user_id: params.userId,
    email_type: params.emailType,
    subject: params.subject,
    body_html: params.bodyHtml,
    entity_id: params.entityId ?? null,
    entity_type: params.entityType ?? null,
    metadata: {
      ...params.metadata,
      recipient_email: params.email,
    },
    status: result.success ? "sent" : "failed",
    sent_at: result.success ? new Date().toISOString() : null,
    error_message: result.error ?? null,
    retry_count: 0,
  });

  if (insertError) {
    logger.warn("Email sent but audit log insert failed", {
      emailType: params.emailType,
      userId: params.userId,
      sendSuccess: result.success,
      insertError: insertError.message,
    });
  }

  if (!result.success) {
    logger.error("Failed to send email", {
      emailType: params.emailType,
      userId: params.userId,
      error: result.error,
    });
    return { success: false, sent: false, error: result.error };
  }

  return { success: true, sent: true };
}
