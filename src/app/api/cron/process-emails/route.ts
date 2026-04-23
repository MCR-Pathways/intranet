/**
 * Cron job: retry failed email sends.
 *
 * Runs daily at 08:03 UTC, after daily-reminders (07:47 UTC). Picks up any
 * email_notifications rows stuck at status='failed' and retries via Resend.
 * Emails are normally sent immediately at trigger time by sendAndLogEmail();
 * this job is the safety net for transient send failures.
 *
 * Triggered by Supabase pg_cron (see migration 00086) via pg_net.http_get →
 * this endpoint. The request header carries CRON_SECRET as a Bearer token,
 * verified via timing-safe compare.
 *
 * Writes a row to `cron_runs` per invocation so run history is
 * SQL-queryable and owned by the app, not the pg_cron system tables.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { timingSafeTokenCompare } from "@/lib/auth";
import type { Json } from "@/types/database.types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JOB_NAME = "process-emails";
const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const SEND_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  // ── Auth ────────────────────────────────────────────────────
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

  const supabase = createServiceClient();
  const startTime = Date.now();

  // ── Start audit row ─────────────────────────────────────────
  const { data: run, error: runInsertErr } = await supabase
    .from("cron_runs")
    .insert({ job_name: JOB_NAME, status: "running" })
    .select("id")
    .single();
  if (runInsertErr) {
    // Don't fail the whole cron if audit write fails — just proceed without it.
    logger.warn("Failed to insert cron_runs row", {
      error: runInsertErr.message,
    });
  }
  const runId = run?.id as string | undefined;

  const finaliseRun = async (
    status: "success" | "failed",
    payload: { result?: Json; error?: string }
  ) => {
    if (!runId) return;
    const { error: finaliseErr } = await supabase
      .from("cron_runs")
      .update({
        finished_at: new Date().toISOString(),
        status,
        result: payload.result ?? null,
        error: payload.error ?? null,
      })
      .eq("id", runId);
    if (finaliseErr) {
      logger.warn(`Failed to finalise cron_runs row (${status})`, {
        runId,
        error: finaliseErr.message,
      });
    }
  };

  try {
    // ── Fetch failed emails for retry ───────────────────────────
    // email_notifications has columns not yet in database.types.ts (body_html, status, retry_count, error_message)
    type EmailNotificationRow = {
      id: string;
      user_id: string;
      email_type: string;
      subject: string;
      body_html: string | null;
      metadata: Record<string, unknown> | null;
      retry_count: number;
    };
    const { data: failed, error: fetchError } = (await supabase
      .from("email_notifications")
      .select("id, user_id, email_type, subject, body_html, metadata, retry_count")
      .eq("status" as never, "failed")
      .lt("retry_count" as never, MAX_RETRIES)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE)) as { data: EmailNotificationRow[] | null; error: { message: string } | null };

    if (fetchError) {
      throw new Error(`Queue fetch failed: ${fetchError.message}`);
    }

    if (!failed || failed.length === 0) {
      const runtimeMs = Date.now() - startTime;
      await finaliseRun("success", {
        result: { retried: 0, sent: 0, stillFailed: 0, persistenceFailed: 0, runtimeMs },
      });
      return Response.json({ retried: 0, sent: 0, stillFailed: 0, persistenceFailed: 0 });
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
    // Counter for rows whose DB persistence failed after the send attempt.
    // Means the email_notifications row is drifting from reality — it'll be
    // picked up again on the next run since retry_count didn't bump. Logged
    // for visibility, surfaced in the cron_runs.result payload.
    let persistenceFailed = 0;

    for (const email of failed) {
      let toEmail =
        (email.metadata as { recipient_email?: string })?.recipient_email;

      if (!toEmail) {
        toEmail = profileEmailMap.get(email.user_id) ?? undefined;
      }

      if (!toEmail) {
        const { error: updateErr } = await supabase
          .from("email_notifications")
          .update({
            error_message: "No recipient email found",
            retry_count: (email.retry_count ?? 0) + 1,
          } as never)
          .eq("id", email.id);
        if (updateErr) {
          logger.warn("Failed to persist no-recipient state", {
            emailId: email.id,
            error: updateErr.message,
          });
          persistenceFailed++;
        }
        stillFailed++;
        continue;
      }

      const result = await sendEmail(toEmail, email.subject, email.body_html ?? "");

      if (result.success) {
        const { error: updateErr } = await supabase
          .from("email_notifications")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            error_message: null,
          } as never)
          .eq("id", email.id);
        sent++;
        if (updateErr) {
          // Email went out but we couldn't mark it sent → will be retried
          // tomorrow, causing a double-send. Break so we don't compound the
          // problem by sending more emails we can't record.
          logger.error("Sent email but failed to persist status=sent — aborting batch", {
            emailId: email.id,
            error: updateErr.message,
          });
          persistenceFailed++;
          break;
        }
      } else {
        const { error: updateErr } = await supabase
          .from("email_notifications")
          .update({
            error_message: result.error ?? "Unknown error",
            retry_count: (email.retry_count ?? 0) + 1,
          } as never)
          .eq("id", email.id);
        if (updateErr) {
          // retry_count didn't bump → row will keep retrying past MAX_RETRIES.
          logger.warn("Failed to persist retry-failure state", {
            emailId: email.id,
            error: updateErr.message,
          });
          persistenceFailed++;
        }
        stillFailed++;
      }

      if (email !== failed[failed.length - 1]) {
        await sleep(SEND_DELAY_MS);
      }
    }

    const runtimeMs = Date.now() - startTime;
    // Treat persistence drift as a failed run. When persistenceFailed > 0,
    // emails have been sent but the DB doesn't know, so those rows will be
    // retried tomorrow and the user gets duplicates. Operators need this
    // surfaced in cron_runs so they can intervene before the next scheduled
    // run fires.
    const persistenceDrift = persistenceFailed > 0;
    await finaliseRun(persistenceDrift ? "failed" : "success", {
      result: {
        retried: failed.length,
        sent,
        stillFailed,
        persistenceFailed,
        runtimeMs,
      },
      ...(persistenceDrift
        ? {
            error: `${persistenceFailed} email_notifications row(s) failed to persist after retry — next run may double-send`,
          }
        : {}),
    });

    logger.info("Email retry processed", {
      retried: failed.length,
      sent,
      stillFailed,
      persistenceFailed,
      runtimeMs,
    });

    return Response.json({ retried: failed.length, sent, stillFailed, persistenceFailed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("process-emails cron failed", { error: message });
    await finaliseRun("failed", { error: message });
    return Response.json({ error: "Cron failed" }, { status: 500 });
  }
}
