import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncUserCalendar } from "@/lib/calendar-sync";
import { logger } from "@/lib/logger";

/**
 * Google Calendar push notification webhook.
 *
 * When a user's calendar changes, Google sends a POST notification here.
 * We look up the user by their channel token and trigger an incremental sync.
 *
 * Headers from Google:
 * - X-Goog-Channel-ID: channel ID we set during watch registration
 * - X-Goog-Channel-Token: token we set (user ID for lookup)
 * - X-Goog-Resource-State: "sync" (initial), "exists" (change), "not_exists" (deleted)
 *
 * Security: validated via GOOGLE_CALENDAR_WEBHOOK_SECRET in the channel token.
 */
export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.GOOGLE_CALENDAR_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error("GOOGLE_CALENDAR_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }

    // Extract Google push notification headers
    const channelToken = request.headers.get("x-goog-channel-token");
    const resourceState = request.headers.get("x-goog-resource-state");

    if (!channelToken) {
      return NextResponse.json({ error: "Missing channel token" }, { status: 400 });
    }

    // Channel token format: "secret:userId"
    const [secret, userId] = channelToken.split(":");
    if (secret !== webhookSecret || !userId) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    // Initial sync notification — acknowledge only
    if (resourceState === "sync") {
      return NextResponse.json({ ok: true });
    }

    // Only process "exists" (resource changed) notifications
    if (resourceState !== "exists") {
      return NextResponse.json({ ok: true });
    }

    // Look up user to get email and sync token
    const supabase = createServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, calendar_sync_token")
      .eq("id", userId)
      .single();

    if (!profile || !profile.email) {
      logger.warn("Calendar webhook for unknown user", { userId });
      return NextResponse.json({ ok: true });
    }

    // Trigger incremental sync
    const result = await syncUserCalendar({
      id: profile.id,
      email: profile.email,
      calendarSyncToken: profile.calendar_sync_token,
    });

    logger.info("Calendar webhook sync complete", {
      userId,
      upserted: result.upserted,
      deleted: result.deleted,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Calendar webhook error", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Always return 200 to Google — retries on non-2xx can cause floods
    return NextResponse.json({ ok: true });
  }
}
