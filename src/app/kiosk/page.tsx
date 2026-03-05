import { createServiceClient } from "@/lib/supabase/service";
import { KioskCheckin } from "@/components/sign-in/kiosk-checkin";
import { timingSafeEqual } from "crypto";
import { getUKToday } from "@/lib/sign-in";

/** Timing-safe string comparison to prevent timing attacks on token validation. */
function timingSafeTokenCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

interface KioskPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function KioskPage({ searchParams }: KioskPageProps) {
  const params = await searchParams;
  const token = params.token;
  const kioskToken = process.env.KIOSK_TOKEN;

  // Validate token (timing-safe comparison to prevent timing attacks)
  if (!kioskToken || !token || !timingSafeTokenCompare(token, kioskToken)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mcr-dark-blue">
        <p className="text-white/50 text-sm">Unauthorised</p>
      </div>
    );
  }

  const supabase = createServiceClient();
  const today = getUKToday();

  // Fetch all active staff with their today's working location
  const [staffResult, locationsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, job_title")
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("working_locations")
      .select("user_id, location, confirmed, source")
      .eq("date", today)
      .eq("time_slot", "full_day")
      .in("location", ["glasgow_office", "stevenage_office"]),
  ]);

  const staff = staffResult.data ?? [];
  const locations = locationsResult.data ?? [];

  // Build a map of userId -> location data
  const locationMap: Record<string, { location: string; confirmed: boolean; source: string }> = {};
  for (const loc of locations) {
    locationMap[loc.user_id] = {
      location: loc.location,
      confirmed: loc.confirmed,
      source: loc.source,
    };
  }

  const staffWithStatus = staff.map((s) => ({
    id: s.id,
    fullName: s.full_name ?? "Unknown",
    avatarUrl: s.avatar_url,
    jobTitle: s.job_title,
    scheduled: !!locationMap[s.id],
    confirmed: locationMap[s.id]?.confirmed ?? false,
  }));

  return (
    <KioskCheckin
      staff={staffWithStatus}
      token={token}
    />
  );
}
