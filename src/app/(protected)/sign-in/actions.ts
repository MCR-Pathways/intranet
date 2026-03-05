"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { WorkLocation, TimeSlot } from "@/types/database.types";
import { getUKToday } from "@/lib/sign-in";

const VALID_LOCATIONS: WorkLocation[] = [
  "home",
  "glasgow_office",
  "stevenage_office",
  "other",
];

const VALID_TIME_SLOTS: TimeSlot[] = ["full_day", "morning", "afternoon"];

// =============================================
// PERSONAL SCHEDULE
// =============================================

/**
 * Set (upsert) a working location for a specific date and time slot.
 * Uses the UNIQUE constraint on (user_id, date, time_slot) for upsert.
 * Does not allow overriding leave-sourced entries — those are managed by the leave system.
 */
export async function setWorkingLocation(
  date: string,
  timeSlot: TimeSlot,
  location: WorkLocation,
  otherLocation?: string
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  if (!VALID_LOCATIONS.includes(location)) {
    return { success: false, error: "Invalid location" };
  }

  if (!VALID_TIME_SLOTS.includes(timeSlot)) {
    return { success: false, error: "Invalid time slot" };
  }

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { success: false, error: "Invalid date format" };
  }

  // Sanitise other_location
  const sanitisedOtherLocation =
    location === "other" ? (otherLocation?.trim().slice(0, 200) || null) : null;

  if (location === "other" && !sanitisedOtherLocation) {
    return { success: false, error: "Please specify your location" };
  }

  // Check if there's a leave-sourced entry for this date/slot
  const { data: existing } = await supabase
    .from("working_locations")
    .select("id, source")
    .eq("user_id", user.id)
    .eq("date", date)
    .eq("time_slot", timeSlot)
    .limit(1);

  if (existing && existing.length > 0 && existing[0].source === "leave") {
    return { success: false, error: "Cannot override a leave entry. Cancel the leave request first." };
  }

  // Upsert — ON CONFLICT (user_id, date, time_slot) UPDATE
  const { error } = await supabase
    .from("working_locations")
    .upsert(
      {
        user_id: user.id,
        date,
        time_slot: timeSlot,
        location,
        other_location: sanitisedOtherLocation,
        source: "manual" as const,
        confirmed: false,
        confirmed_at: null,
        google_event_id: null,
        leave_request_id: null,
      },
      { onConflict: "user_id,date,time_slot" }
    );

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/sign-in");
  return { success: true, error: null };
}

/**
 * Clear (delete) a working location entry for a specific date and time slot.
 * Does not allow deleting leave-sourced entries.
 */
export async function clearWorkingLocation(
  date: string,
  timeSlot: TimeSlot
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Check source before deleting (don't delete leave entries)
  const { data: existing } = await supabase
    .from("working_locations")
    .select("id, source")
    .eq("user_id", user.id)
    .eq("date", date)
    .eq("time_slot", timeSlot)
    .limit(1);

  if (!existing || existing.length === 0) {
    return { success: true, error: null }; // Nothing to delete
  }

  if (existing[0].source === "leave") {
    return { success: false, error: "Cannot remove a leave entry. Cancel the leave request first." };
  }

  const { error } = await supabase
    .from("working_locations")
    .delete()
    .eq("id", existing[0].id)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/sign-in");
  return { success: true, error: null };
}

/**
 * Get the current user's schedule for a date range.
 */
export async function getMySchedule(startDate: string, endDate: string) {
  const { supabase, user } = await getCurrentUser();

  if (!user) return { entries: [] };

  const { data } = await supabase
    .from("working_locations")
    .select("id, user_id, date, time_slot, location, other_location, source, confirmed, confirmed_at, leave_request_id")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })
    .order("time_slot", { ascending: true });

  return { entries: data ?? [] };
}

/**
 * Confirm arrival (mark today's entries as confirmed).
 * Used by the "I'm Here" button in the reconciliation banner
 * and by the kiosk check-in flow (via the API route).
 */
export async function confirmArrival(): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const today = getUKToday();

  const { error } = await supabase
    .from("working_locations")
    .update({
      confirmed: true,
      confirmed_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("date", today)
    .in("location", ["glasgow_office", "stevenage_office"]);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/sign-in");
  return { success: true, error: null };
}

// =============================================
// WEEKLY PATTERNS
// =============================================

/**
 * Get the current user's weekly patterns.
 */
export async function getMyPatterns() {
  const { supabase, user } = await getCurrentUser();

  if (!user) return { patterns: [] };

  const { data } = await supabase
    .from("weekly_patterns")
    .select("id, user_id, day_of_week, time_slot, location, other_location")
    .eq("user_id", user.id)
    .order("day_of_week", { ascending: true })
    .order("time_slot", { ascending: true });

  return { patterns: data ?? [] };
}

/**
 * Save a weekly pattern (upsert).
 */
export async function saveWeeklyPattern(
  dayOfWeek: number,
  timeSlot: TimeSlot,
  location: WorkLocation,
  otherLocation?: string
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  if (dayOfWeek < 0 || dayOfWeek > 6) {
    return { success: false, error: "Invalid day of week" };
  }

  if (!VALID_LOCATIONS.includes(location)) {
    return { success: false, error: "Invalid location" };
  }

  const sanitisedOtherLocation =
    location === "other" ? (otherLocation?.trim().slice(0, 200) || null) : null;

  const { error } = await supabase
    .from("weekly_patterns")
    .upsert(
      {
        user_id: user.id,
        day_of_week: dayOfWeek,
        time_slot: timeSlot,
        location,
        other_location: sanitisedOtherLocation,
      },
      { onConflict: "user_id,day_of_week,time_slot" }
    );

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/sign-in");
  return { success: true, error: null };
}

/**
 * Clear a weekly pattern entry.
 */
export async function clearWeeklyPattern(
  dayOfWeek: number,
  timeSlot: TimeSlot
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("weekly_patterns")
    .delete()
    .eq("user_id", user.id)
    .eq("day_of_week", dayOfWeek)
    .eq("time_slot", timeSlot);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/sign-in");
  return { success: true, error: null };
}

/**
 * Apply the user's weekly patterns to a target week, filling gaps only.
 * Skips dates that already have manual, calendar, or leave entries.
 * Creates entries with source='pattern'.
 */
export async function applyPatternsToWeek(
  weekStartDate: string
): Promise<{ success: boolean; applied: number; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, applied: 0, error: "Not authenticated" };
  }

  // Get user's patterns
  const { data: patterns } = await supabase
    .from("weekly_patterns")
    .select("day_of_week, time_slot, location, other_location")
    .eq("user_id", user.id);

  if (!patterns || patterns.length === 0) {
    return { success: true, applied: 0, error: null };
  }

  // Calculate the 5 weekdays (Mon-Fri)
  const monday = new Date(weekStartDate + "T12:00:00");
  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }

  // Get existing entries for the week
  const weekEndDate = dates[dates.length - 1];
  const { data: existing } = await supabase
    .from("working_locations")
    .select("date, time_slot, source")
    .eq("user_id", user.id)
    .gte("date", weekStartDate)
    .lte("date", weekEndDate);

  // Build set of existing (date, time_slot) pairs with priority sources
  const existingSet = new Set(
    (existing ?? [])
      .filter((e) => e.source !== "pattern") // Only skip for manual/calendar/leave
      .map((e) => `${e.date}|${e.time_slot}`)
  );

  // Build entries to upsert
  const entries = [];
  for (const dateStr of dates) {
    const dayDate = new Date(dateStr + "T12:00:00");
    const dayOfWeek = dayDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    for (const pattern of patterns) {
      if (pattern.day_of_week === dayOfWeek) {
        const key = `${dateStr}|${pattern.time_slot}`;
        if (!existingSet.has(key)) {
          entries.push({
            user_id: user.id,
            date: dateStr,
            time_slot: pattern.time_slot as TimeSlot,
            location: pattern.location as WorkLocation,
            other_location: pattern.other_location,
            source: "pattern" as const,
            confirmed: false,
          });
        }
      }
    }
  }

  if (entries.length === 0) {
    return { success: true, applied: 0, error: null };
  }

  const { error } = await supabase
    .from("working_locations")
    .upsert(entries, { onConflict: "user_id,date,time_slot" });

  if (error) {
    return { success: false, applied: 0, error: error.message };
  }

  revalidatePath("/sign-in");
  return { success: true, applied: entries.length, error: null };
}

// =============================================
// TEAM SCHEDULE (MANAGER VIEW)
// =============================================

/**
 * Get schedule data for the manager's direct reports in a date range.
 */
export async function getTeamSchedule(startDate: string, endDate: string) {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile?.is_line_manager) {
    return { members: [], error: "Unauthorised" };
  }

  // Get active direct reports
  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name, avatar_url, job_title")
    .eq("line_manager_id", user.id)
    .eq("status", "active")
    .order("full_name");

  if (!members || members.length === 0) {
    return { members: [], error: null };
  }

  const memberIds = members.map((m) => m.id);

  // Get entries for those members
  const { data: entries } = await supabase
    .from("working_locations")
    .select("id, user_id, date, time_slot, location, other_location, source, confirmed, confirmed_at, leave_request_id")
    .in("user_id", memberIds)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  // Build map: user_id -> entries
  const entryMap = new Map<string, typeof entries>();
  for (const entry of entries ?? []) {
    const arr = entryMap.get(entry.user_id) ?? [];
    arr.push(entry);
    entryMap.set(entry.user_id, arr);
  }

  const membersWithEntries = members.map((member) => ({
    ...member,
    entries: entryMap.get(member.id) ?? [],
  }));

  return { members: membersWithEntries, error: null };
}

// =============================================
// OFFICE HEADCOUNT (HR DASHBOARD)
// =============================================

/**
 * Get office headcount data for a date range.
 * Returns daily counts of scheduled and confirmed staff for office locations.
 * Accessible to HR admins only.
 */
export async function getOfficeHeadcount(startDate: string, endDate: string) {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile?.is_hr_admin) {
    return { days: [], error: "Unauthorised" };
  }

  const { data } = await supabase
    .from("working_locations")
    .select("date, location, confirmed, user_id, source")
    .in("location", ["glasgow_office", "stevenage_office"])
    .gte("date", startDate)
    .lte("date", endDate)
    .eq("time_slot", "full_day")
    .order("date", { ascending: true });

  if (!data) {
    return { days: [], error: null };
  }

  // Group by date
  const dayMap = new Map<string, { scheduled: number; confirmed: number; members: { userId: string; source: string; confirmed: boolean }[] }>();

  for (const entry of data) {
    const day = dayMap.get(entry.date) ?? { scheduled: 0, confirmed: 0, members: [] };
    day.scheduled++;
    if (entry.confirmed) day.confirmed++;
    day.members.push({
      userId: entry.user_id,
      source: entry.source,
      confirmed: entry.confirmed,
    });
    dayMap.set(entry.date, day);
  }

  const days = Array.from(dayMap.entries()).map(([date, counts]) => ({
    date,
    ...counts,
    belowTarget: counts.scheduled < 4,
  }));

  return { days, error: null };
}
