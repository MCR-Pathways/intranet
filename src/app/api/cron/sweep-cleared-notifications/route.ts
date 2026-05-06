/**
 * Cron job: hard-delete cleared notifications older than 30 days.
 *
 * The retention rule (memory/intranet-design-feedback.md, W3-rev locked
 * scope): when a notification is Cleared, it stays accessible in the
 * Cleared tab on /notifications for 30 days, then disappears. Matches
 * Microsoft Teams' 4-week activity-feed retention.
 *
 * Triggered by Supabase pg_cron (migration 00093) via pg_net.http_get.
 * Bearer-token authenticated against CRON_SECRET. Writes a row to
 * `cron_runs` per invocation for SQL-queryable history.
 *
 * Lightweight: a single DELETE with an indexed predicate
 * (idx_notifications_cleared_at). No per-row work, no external API calls.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";
import { timingSafeTokenCompare } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JOB_NAME = "sweep-cleared-notifications";
const RETENTION_DAYS = 30;

export async function GET(request: Request) {
  // ── Production guard ────────────────────────────────────────
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return Response.json(
      { error: "Cron runs in production only" },
      { status: 403 },
    );
  }

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
    logger.warn("Failed to insert cron_runs row", {
      error: runInsertErr.message,
    });
  }
  const runId = run?.id as string | undefined;

  try {
    const cutoff = new Date(
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { count, error: deleteErr } = await supabase
      .from("notifications")
      .delete({ count: "exact" })
      .eq("is_cleared", true)
      .lt("cleared_at", cutoff);

    if (deleteErr) throw deleteErr;

    const deletedCount = count ?? 0;
    const runtimeMs = Date.now() - startTime;

    if (runId) {
      const { error: finaliseErr } = await supabase
        .from("cron_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "success",
          result: { deletedCount, cutoff, runtimeMs },
        })
        .eq("id", runId);
      if (finaliseErr) {
        logger.warn("Failed to finalise cron_runs row (success)", {
          runId,
          error: finaliseErr.message,
        });
      }
    }

    logger.info("Cleared-notifications sweep complete", {
      deletedCount,
      cutoff,
      runtimeMs,
    });

    return Response.json({ deletedCount, cutoff, runtimeMs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("sweep-cleared-notifications cron failed", { error: message });

    if (runId) {
      const { error: finaliseErr } = await supabase
        .from("cron_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "failed",
          error: message,
        })
        .eq("id", runId);
      if (finaliseErr) {
        logger.warn("Failed to finalise cron_runs row (failed)", {
          runId,
          error: finaliseErr.message,
        });
      }
    }

    return Response.json({ error: "Cron failed" }, { status: 500 });
  }
}
