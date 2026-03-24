/**
 * Vercel Cron job: Generate daily reminder emails.
 *
 * Runs daily at ~7am UTC Mon-Fri (7am GMT winter, 8am BST summer).
 * Queries overdue courses, compliance expiry, key dates, stale leave.
 * Inserts matching reminders into the email_notifications queue.
 * The process-emails Cron job sends them on the next ~15-min run.
 *
 * Security: Requires CRON_SECRET Bearer token (set by Vercel automatically).
 */

import { logger } from "@/lib/logger";
import { timingSafeTokenCompare } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  // ── Generate reminders ──────────────────────────────────────
  const results = {
    learningReminders: 0,
    hrReminders: 0,
  };

  // L&D reminders (added in PR 2)
  // HR reminders (added in PR 3)

  logger.info("Daily reminders generated", results);
  return Response.json(results);
}
