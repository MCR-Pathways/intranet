/**
 * Vercel Cron job: Retry failed email sends.
 *
 * Runs daily at 8:03 AM UTC, after daily-reminders (7:47 UTC).
 * Picks up emails that failed to send (from action triggers or
 * daily-reminders) and retries via Resend. Safety net only —
 * emails are sent immediately at trigger time by sendAndLogEmail().
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
const SEND_DELAY_MS = 500;

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

  // ── Fetch failed emails for retry ───────────────────────────
  const supabase = createServiceClient();

  const { data: failed, error: fetchError } = await supabase
    .from("email_notifications")
    .select("id, user_id, email_type, subject, body_html, metadata, retry_count")
    .eq("status", "failed")
    .lt("retry_count", MAX_RETRIES)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    logger.error("Failed to fetch retry queue", { error: fetchError.message });
    return Response.json({ error: "Queue fetch failed" }, { status: 500 });
  }

  if (!failed || failed.length === 0) {
    return Response.json({ retried: 0, sent: 0, failed: 0 });
  }

  // ── Batch-fetch fallback emails for entries missing metadata ──
  const missingRecipientIds = [...new Set(
    failed
      .filter((e) => !(e.metadata as { recipient_email?: string })?.recipient_email)
      .map((e) => e.user_id)
  )];

  const { data: fallbackProfiles } = missingRecipientIds.length > 0
    ? await supabase.from("profiles").select("id, email").in("id", missingRecipientIds)
    : { data: [] };

  const profileEmailMap = new Map(
    (fallbackProfiles ?? []).map((p) => [p.id, p.email])
  );

  // ── Retry sends ─────────────────────────────────────────────
  let sent = 0;
  let stillFailed = 0;

  for (const email of failed) {
    let toEmail =
      (email.metadata as { recipient_email?: string })?.recipient_email;

    if (!toEmail) {
      toEmail = profileEmailMap.get(email.user_id) ?? undefined;
    }

    if (!toEmail) {
      await supabase
        .from("email_notifications")
        .update({
          error_message: "No recipient email found",
          retry_count: (email.retry_count ?? 0) + 1,
        })
        .eq("id", email.id);
      stillFailed++;
      continue;
    }

    const result = await sendEmail(toEmail, email.subject, email.body_html ?? "");

    if (result.success) {
      await supabase
        .from("email_notifications")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", email.id);
      sent++;
    } else {
      await supabase
        .from("email_notifications")
        .update({
          error_message: result.error ?? "Unknown error",
          retry_count: (email.retry_count ?? 0) + 1,
        })
        .eq("id", email.id);
      stillFailed++;
    }

    if (email !== failed[failed.length - 1]) {
      await sleep(SEND_DELAY_MS);
    }
  }

  logger.info("Email retry processed", {
    retried: failed.length,
    sent,
    stillFailed,
  });

  return Response.json({ retried: failed.length, sent, stillFailed });
}
