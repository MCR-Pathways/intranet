import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { timingSafeEqual } from "crypto";

/** Timing-safe string comparison to prevent timing attacks on token validation. */
function timingSafeTokenCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Kiosk check-in confirmation endpoint.
 * Token-authenticated (not user auth) — called from the kiosk tablet.
 * Uses service role client to bypass RLS.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, token } = body;

    // Validate token (timing-safe comparison)
    const kioskToken = process.env.KIOSK_TOKEN;
    if (!kioskToken || typeof token !== "string" || !timingSafeTokenCompare(token, kioskToken)) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get today's date in UK timezone
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

    // Check if already confirmed today
    const { data: existing } = await supabase
      .from("working_locations")
      .select("id, confirmed")
      .eq("user_id", userId)
      .eq("date", today)
      .in("location", ["glasgow_office", "stevenage_office"])
      .limit(1);

    if (existing && existing.length > 0 && existing[0].confirmed) {
      return NextResponse.json({ success: true, alreadyConfirmed: true });
    }

    const now = new Date().toISOString();

    if (existing && existing.length > 0) {
      // Update existing entry to confirmed
      const { error } = await supabase
        .from("working_locations")
        .update({ confirmed: true, confirmed_at: now })
        .eq("user_id", userId)
        .eq("date", today)
        .in("location", ["glasgow_office", "stevenage_office"]);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // No entry exists — create one (walk-in, not pre-scheduled)
      const { error } = await supabase
        .from("working_locations")
        .upsert(
          {
            user_id: userId,
            date: today,
            time_slot: "full_day",
            location: "glasgow_office",
            source: "manual",
            confirmed: true,
            confirmed_at: now,
          },
          { onConflict: "user_id,date,time_slot" }
        );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, alreadyConfirmed: false });
  } catch (err) {
    // Distinguish client errors (bad JSON) from server errors
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
