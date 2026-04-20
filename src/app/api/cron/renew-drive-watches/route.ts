/**
 * Cron job: renew Google Drive push-notification watch channels before they
 * expire. Keeps linked Google Docs auto-syncing forever.
 *
 * Drive documents "up to 7 days" for watch lifetime, but in practice files.watch
 * returns channels that live ~24 hours. The daily 03:00 UTC schedule renews
 * every linked doc every run because the 36h threshold always catches a 24h
 * channel. Verified empirically on 2026-04-20.
 *
 * Triggered by Supabase pg_cron (see migration 00083) via pg_net.http_get →
 * this endpoint. The request header carries CRON_SECRET as a Bearer token;
 * we verify via timing-safe compare.
 *
 * Writes a row to `cron_runs` per invocation so run history is
 * SQL-queryable and owned by the app, not the pg_cron system tables.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { watchFile, stopWatchChannel } from "@/lib/google-drive";
import { logger } from "@/lib/logger";
import { timingSafeTokenCompare } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const JOB_NAME = "renew-drive-watches";
const RENEW_WITHIN_HOURS = 36;

// Trigger thresholds: when this run processes more rows or takes longer than
// these values, emit a warning so we revisit the sequential-loop design
// (see memory/feedback_supabase_cron.md for options — `.limit()` escape hatch
// or `Promise.all` concurrency). The values sit comfortably below the hard
// ceiling (maxDuration=300s, Drive API quotas) to give us lead time to act.
const SCALE_WARN_TOTAL = 250;
const SCALE_WARN_RUNTIME_MS = 200_000;

export async function GET(request: Request) {
  // ── Production guard ────────────────────────────────────────
  // Dev/preview environments must not fire this cron against the production
  // Drive API via misconfigured secrets.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return Response.json(
      { error: "Cron runs in production only" },
      { status: 403 }
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

  // ── Env ─────────────────────────────────────────────────────
  // Trim defensively — env vars pasted via dashboards can pick up trailing
  // newlines that Google then rejects as "No valid host or IP for WebHook
  // callback". Observed once in production on 2026-04-20.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const webhookSecret = process.env.GOOGLE_DRIVE_WEBHOOK_SECRET?.trim();
  if (!appUrl || !webhookSecret) {
    logger.error("Drive webhook env missing", {
      hasAppUrl: !!appUrl,
      hasWebhookSecret: !!webhookSecret,
    });
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const webhookUrl = `${appUrl}/api/drive/webhook`;

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

  try {
    // ── Query articles due for renewal ────────────────────────
    const threshold = new Date(
      Date.now() + RENEW_WITHIN_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { data: articles, error: queryErr } = await supabase
      .from("resource_articles")
      .select(
        "id, google_doc_id, google_watch_channel_id, google_watch_resource_id"
      )
      .eq("content_type", "google_doc")
      .not("google_doc_id", "is", null)
      .or(
        `google_watch_expires_at.is.null,google_watch_expires_at.lt.${threshold}`
      )
      .order("google_watch_expires_at", {
        ascending: true,
        nullsFirst: true,
      });

    if (queryErr) throw queryErr;

    const total = articles?.length ?? 0;
    let renewed = 0;
    let failed = 0;

    for (const article of articles ?? []) {
      try {
        const docId = article.google_doc_id;
        if (!docId) continue;

        const newChannelId = `resource-${article.id}-${Date.now()}`;
        const watchResult = await watchFile(
          docId,
          newChannelId,
          webhookUrl,
          `${webhookSecret}:${docId}`
        );

        if (!watchResult?.resourceId) {
          logger.warn("Drive watch renewal returned no result", {
            articleId: article.id,
          });
          failed++;
          continue;
        }

        // Parse expiration with a fallback for empty/malformed strings.
        // Drive returns ~24h-lifetime channels in practice (verified 2026-04-20).
        // Fallback to 23h so bad expiration data self-heals on the next daily
        // run instead of storing a stale future timestamp that the threshold
        // query would skip until the actual channel has silently died.
        const expirationMs = Number(watchResult.expiration);
        const expiresAt =
          Number.isFinite(expirationMs) && expirationMs > 0
            ? new Date(expirationMs).toISOString()
            : new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();

        // Persist new state first so retries and unlink always see fresh values.
        const { error: updateErr } = await supabase
          .from("resource_articles")
          .update({
            google_watch_channel_id: watchResult.channelId,
            google_watch_resource_id: watchResult.resourceId,
            google_watch_expires_at: expiresAt,
          })
          .eq("id", article.id);

        if (updateErr) {
          // New channel exists on Google's side but we couldn't persist.
          // Let the row retry next run — the new channel will be treated as
          // the 'old' one to stop. Worst case: double notifications for a day.
          logger.error("Failed to persist renewed watch state", {
            articleId: article.id,
            error: updateErr.message,
          });
          failed++;
          continue;
        }

        // Best-effort stop of the old channel. Uses stored channel id when
        // available; falls back to the pre-00081 reconstruction pattern for
        // rows that were linked before this migration.
        if (article.google_watch_resource_id) {
          const oldChannelId =
            article.google_watch_channel_id ?? `resource-${article.id}`;
          await stopWatchChannel(
            oldChannelId,
            article.google_watch_resource_id
          );
        }

        renewed++;
      } catch (err) {
        logger.error("Drive watch renewal failed for article", {
          articleId: article.id,
          error: err instanceof Error ? err.message : String(err),
        });
        failed++;
      }
    }

    // ── Scale trigger ─────────────────────────────────────────
    // When the batch crosses the pre-set thresholds, warn so the next
    // periodic sync / log review picks it up and we revisit the design
    // before we actually hit maxDuration. The flag is also written into
    // cron_runs.result for SQL-side visibility.
    const runtimeMs = Date.now() - startTime;
    const scaleWarning =
      total >= SCALE_WARN_TOTAL || runtimeMs >= SCALE_WARN_RUNTIME_MS;
    if (scaleWarning) {
      logger.warn(
        "renew-drive-watches approaching scale threshold — consider adding .limit() or concurrent batching (see memory/feedback_supabase_cron.md)",
        { total, runtimeMs, threshold: { SCALE_WARN_TOTAL, SCALE_WARN_RUNTIME_MS } }
      );
    }

    // ── Finalise audit row ────────────────────────────────────
    if (runId) {
      const { error: finaliseErr } = await supabase
        .from("cron_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "success",
          result: {
            renewed,
            failed,
            total,
            runtimeMs,
            scaleWarning,
          },
        })
        .eq("id", runId);
      if (finaliseErr) {
        // Row will remain at status='running' — log so we know if audit
        // drift shows up in the table.
        logger.warn("Failed to finalise cron_runs row (success)", {
          runId,
          error: finaliseErr.message,
        });
      }
    }

    logger.info("Drive watch renewal cron complete", {
      renewed,
      failed,
      total,
      runtimeMs,
    });
    return Response.json({ renewed, failed, total, runtimeMs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Drive watch renewal cron failed", { error: message });
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
