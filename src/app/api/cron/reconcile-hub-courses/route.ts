/**
 * Cron job: reconcile the live Chat hub catalogue into native `courses` shells.
 *
 * Mirrors each published, intranet-destined Chat course into a local
 * `courses` row (source='hub') so learners enrol, earn certificates, and
 * appear in reports against a native record. Courses no longer in the live
 * Chat set are deactivated (not deleted) so completions and certificates
 * survive. See `reconcileHubCourses` for the per-course logic.
 *
 * Triggered by Supabase pg_cron (migration 00101) via pg_net.http_get, and
 * by the manual admin trigger (`manualReconcileHubCourses`). Bearer-token
 * authenticated against CRON_SECRET. Writes a row to `cron_runs` per
 * invocation for SQL-queryable history.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { reconcileHubCourses } from "@/lib/chat-content/reconcile";
import { logger } from "@/lib/logger";
import { timingSafeTokenCompare } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JOB_NAME = "reconcile-hub-courses";

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
    const { inserted, updated, deactivated, blockErrors } =
      await reconcileHubCourses();

    const runtimeMs = Date.now() - startTime;
    const hadErrors = blockErrors.length > 0;
    const result = {
      inserted,
      updated,
      deactivated,
      runtimeMs,
      ...(hadErrors ? { blockErrors } : {}),
    };

    if (runId) {
      const { error: finaliseErr } = await supabase
        .from("cron_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: hadErrors ? "failed" : "success",
          result,
        })
        .eq("id", runId);
      if (finaliseErr) {
        logger.warn("Failed to finalise cron_runs row", {
          runId,
          error: finaliseErr.message,
        });
      }
    }

    logger.info("Hub course reconciliation cron complete", result);

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("reconcile-hub-courses cron failed", { error: message });

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
