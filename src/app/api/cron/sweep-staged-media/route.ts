/**
 * Cron job: sweep orphaned news_feed_media rows.
 *
 * The eager paths (post-creation hand-off, X-click discard, composer
 * discard) handle 99% of cleanup. This catches edge cases:
 *   - Browser tab closed mid-post
 *   - Network failure between upload and post insert
 *   - Server crash during the post action
 *   - Discard server action that failed
 *
 * Strategy: any news_feed_media row older than 24h with no matching
 * post_attachments.drive_file_id row is considered abandoned. Delete the
 * Drive file then the row. The 24h grace window ensures slow uploads
 * (paused composer left open) don't get reaped.
 *
 * Triggered by Supabase pg_cron (see migration 00088) via pg_net.http_get.
 * Bearer-token authenticated against CRON_SECRET. Writes a row to
 * `cron_runs` per invocation for SQL-queryable history.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { deleteFileFromDrive } from "@/lib/google-drive-upload";
import { logger } from "@/lib/logger";
import { timingSafeTokenCompare } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const JOB_NAME = "sweep-staged-media";
const ORPHAN_AGE_HOURS = 24;

// Trigger thresholds — emit a warning when the batch grows so we revisit
// the sequential-loop design before hitting maxDuration. Pattern from
// renew-drive-watches per memory/feedback_supabase_cron.md.
const SCALE_WARN_TOTAL = 250;
const SCALE_WARN_RUNTIME_MS = 200_000;

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
      Date.now() - ORPHAN_AGE_HOURS * 60 * 60 * 1000,
    ).toISOString();

    // Candidate orphans: staging rows older than the grace window. We
    // narrow further below by checking if any of these file_ids ALSO
    // appear in post_attachments — if they do, leave them alone (they
    // were promoted but the staging delete failed; cosmetic redundancy,
    // not orphaned).
    const { data: candidates, error: queryErr } = await supabase
      .from("news_feed_media")
      .select("id, file_id")
      .lt("created_at", cutoff);

    if (queryErr) throw queryErr;

    const candidateIds = (candidates ?? []).map((c) => c.file_id);
    if (candidateIds.length === 0) {
      const runtimeMs = Date.now() - startTime;
      if (runId) {
        await supabase
          .from("cron_runs")
          .update({
            finished_at: new Date().toISOString(),
            status: "success",
            result: { swept: 0, total: 0, runtimeMs, scaleWarning: false },
          })
          .eq("id", runId);
      }
      return Response.json({ swept: 0, total: 0, runtimeMs });
    }

    // Cross-reference: file_ids that ALREADY exist in post_attachments
    // shouldn't be swept (they were promoted; staging row is just lingering).
    const { data: promoted, error: promotedErr } = await supabase
      .from("post_attachments")
      .select("drive_file_id")
      .in("drive_file_id", candidateIds);

    if (promotedErr) throw promotedErr;

    const promotedSet = new Set(
      (promoted ?? [])
        .map((p) => p.drive_file_id)
        .filter((id): id is string => id !== null),
    );

    const orphans = (candidates ?? []).filter(
      (c) => !promotedSet.has(c.file_id),
    );

    let swept = 0;
    let failed = 0;

    for (const orphan of orphans) {
      try {
        await deleteFileFromDrive(orphan.file_id);
        const { error: deleteErr } = await supabase
          .from("news_feed_media")
          .delete()
          .eq("id", orphan.id);
        if (deleteErr) {
          logger.warn("Failed to delete swept news_feed_media row", {
            id: orphan.id,
            error: deleteErr.message,
          });
          failed++;
          continue;
        }
        swept++;
      } catch (err) {
        logger.error("Failed to sweep staged media", {
          fileId: orphan.file_id,
          error: err instanceof Error ? err.message : String(err),
        });
        failed++;
      }
    }

    // Also clean up promoted-but-lingering rows. Cosmetic, but free since
    // we already have the list. No Drive call — file is in active use.
    const lingering = (candidates ?? []).filter((c) =>
      promotedSet.has(c.file_id),
    );
    if (lingering.length > 0) {
      await supabase
        .from("news_feed_media")
        .delete()
        .in(
          "id",
          lingering.map((l) => l.id),
        );
    }

    const runtimeMs = Date.now() - startTime;
    const scaleWarning =
      orphans.length >= SCALE_WARN_TOTAL || runtimeMs >= SCALE_WARN_RUNTIME_MS;
    if (scaleWarning) {
      logger.warn(
        "sweep-staged-media approaching scale threshold — consider adding .limit() or concurrent batching",
        { total: orphans.length, runtimeMs },
      );
    }

    if (runId) {
      const { error: finaliseErr } = await supabase
        .from("cron_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "success",
          result: {
            swept,
            failed,
            lingeringCleared: lingering.length,
            total: orphans.length,
            runtimeMs,
            scaleWarning,
          },
        })
        .eq("id", runId);
      if (finaliseErr) {
        logger.warn("Failed to finalise cron_runs row (success)", {
          runId,
          error: finaliseErr.message,
        });
      }
    }

    logger.info("sweep-staged-media cron complete", {
      swept,
      failed,
      total: orphans.length,
      runtimeMs,
    });
    return Response.json({
      swept,
      failed,
      total: orphans.length,
      runtimeMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("sweep-staged-media cron failed", { error: message });
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
