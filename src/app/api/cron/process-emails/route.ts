/**
 * Vercel Cron job: Process the email notification queue.
 *
 * Runs every ~15 minutes Mon-Fri 7am-7pm UTC.
 * Claims pending/failed emails, sends via Resend, updates status.
 *
 * Security: Requires CRON_SECRET Bearer token (set by Vercel automatically).
 */

import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { timingSafeTokenCompare } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const SEND_DELAY_MS = 500; // 2 emails/sec to respect Resend rate limits

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  // ── Verify CRON_SECRET ──────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error("CRON_SECRET not configured");
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "") ?? "";

  if (!timingSafeTokenCompare(token, cronSecret)) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  // ── Claim batch ─────────────────────────────────────────────
  const supabase = createServiceClient();

  // Fetch pending or retryable failed emails
  const { data: pending, error: fetchError } = await supabase
    .from("email_notifications")
    .select("id, user_id, email_type, subject, body_html, metadata, retry_count")
    .or(`status.eq.pending,and(status.eq.failed,retry_count.lt.${MAX_RETRIES})`)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    logger.error("Failed to fetch email queue", { error: fetchError.message });
    return Response.json({ error: "Queue fetch failed" }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return Response.json({ processed: 0, sent: 0, failed: 0 });
  }

  // Mark as processing
  const ids = pending.map((e) => e.id);
  await supabase
    .from("email_notifications")
    .update({ status: "processing" })
    .in("id", ids);

  // ── Send emails ─────────────────────────────────────────────
  let sent = 0;
  let failed = 0;

  for (const email of pending) {
    const recipientEmail =
      (email.metadata as Record<string, unknown>)?.recipient_email as string | undefined;

    if (!recipientEmail) {
      // Try fetching from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", email.user_id)
        .single();

      if (!profile?.email) {
        await supabase
          .from("email_notifications")
          .update({
            status: "failed",
            error_message: "No recipient email found",
            retry_count: (email.retry_count ?? 0) + 1,
          })
          .eq("id", email.id);
        failed++;
        continue;
      }

      // Send with profile email
      const result = await sendEmail(
        profile.email as string,
        email.subject,
        email.body_html ?? ""
      );

      if (result.success) {
        await supabase
          .from("email_notifications")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", email.id);
        sent++;
      } else {
        await supabase
          .from("email_notifications")
          .update({
            status: "failed",
            error_message: result.error ?? "Unknown error",
            retry_count: (email.retry_count ?? 0) + 1,
          })
          .eq("id", email.id);
        failed++;
      }
    } else {
      const result = await sendEmail(
        recipientEmail,
        email.subject,
        email.body_html ?? ""
      );

      if (result.success) {
        await supabase
          .from("email_notifications")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", email.id);
        sent++;
      } else {
        await supabase
          .from("email_notifications")
          .update({
            status: "failed",
            error_message: result.error ?? "Unknown error",
            retry_count: (email.retry_count ?? 0) + 1,
          })
          .eq("id", email.id);
        failed++;
      }
    }

    // Rate limit: 500ms between sends
    if (pending.indexOf(email) < pending.length - 1) {
      await sleep(SEND_DELAY_MS);
    }
  }

  logger.info("Email queue processed", {
    processed: pending.length,
    sent,
    failed,
  });

  return Response.json({ processed: pending.length, sent, failed });
}
