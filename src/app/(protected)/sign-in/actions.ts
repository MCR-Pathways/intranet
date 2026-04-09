"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Database, WorkLocation, TimeSlot } from "@/types/database.types";
import { getUKToday, OFFICE_LOCATIONS, OFFICE_HEADCOUNT_TARGET } from "@/lib/sign-in";
import { logger } from "@/lib/logger";

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
    .select("id, source, google_event_id")
    .eq("user_id", user.id)
    .eq("date", date)
    .eq("time_slot", timeSlot)
    .limit(1);

  if (existing && existing.length > 0 && existing[0].source === "leave") {
    return { success: false, error: "Cannot override a leave entry. Cancel the leave request first." };
  }

  const existingEventId = existing?.[0]?.google_event_id ?? null;

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
        google_event_id: existingEventId,
        leave_request_id: null,
      },
      { onConflict: "user_id,date,time_slot" }
    );

  if (error) {
    logger.error("Failed to set working location", { error });
    return { success: false, error: "Failed to set working location. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  // Write-back to Google Calendar (non-blocking, full_day only)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && timeSlot === "full_day") {
    try {
      const { writeWorkingLocationEvent } = await import("@/lib/google-calendar");
      const eventId = await writeWorkingLocationEvent(
        user.email!,
        date,
        location as "home" | "glasgow_office" | "stevenage_office" | "other",
        sanitisedOtherLocation,
        existingEventId,
      );

      // Store the Calendar event ID if we got one
      if (eventId && eventId !== existingEventId) {
        await supabase
          .from("working_locations")
          .update({ google_event_id: eventId })
          .eq("user_id", user.id)
          .eq("date", date)
          .eq("time_slot", timeSlot);
      }
    } catch (err) {
      logger.warn("Calendar write-back failed", {
        date,
        error: err instanceof Error ? err.message : String(err),
      });
    }
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
    .select("id, source, google_event_id")
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

  const googleEventId = existing[0].google_event_id;

  const { error } = await supabase
    .from("working_locations")
    .delete()
    .eq("id", existing[0].id)
    .eq("user_id", user.id);

  if (error) {
    logger.error("Failed to clear working location", { error });
    return { success: false, error: "Failed to clear working location. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  // Delete the Google Calendar event if one exists (non-blocking)
  if (googleEventId && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const { deleteCalendarEvent } = await import("@/lib/google-calendar");
      await deleteCalendarEvent(user.email!, googleEventId);
    } catch (err) {
      logger.warn("Calendar event deletion failed", {
        date,
        error: err instanceof Error ? err.message : String(err),
      });
    }
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
    logger.error("Failed to confirm arrival", { error });
    return { success: false, error: "Failed to confirm arrival. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
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

  // Enforce mutual exclusivity: full_day and split-day entries can't coexist
  if (timeSlot === "full_day") {
    // Setting full_day → remove any morning/afternoon entries
    await supabase
      .from("weekly_patterns")
      .delete()
      .eq("user_id", user.id)
      .eq("day_of_week", dayOfWeek)
      .in("time_slot", ["morning", "afternoon"]);
  } else {
    // Setting morning/afternoon → remove any full_day entry
    await supabase
      .from("weekly_patterns")
      .delete()
      .eq("user_id", user.id)
      .eq("day_of_week", dayOfWeek)
      .eq("time_slot", "full_day");
  }

  const { error } = await supabase
    .from("weekly_patterns")
    .upsert(
      {
        user_id: user.id,
        day_of_week: dayOfWeek,
        time_slot: timeSlot,
        location: location as Database["public"]["Tables"]["weekly_patterns"]["Insert"]["location"],
        other_location: sanitisedOtherLocation,
      },
      { onConflict: "user_id,day_of_week,time_slot" }
    );

  if (error) {
    logger.error("Failed to save weekly pattern", { error });
    return { success: false, error: "Failed to save weekly pattern. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
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
    logger.error("Failed to clear weekly pattern", { error });
    return { success: false, error: "Failed to clear weekly pattern. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
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
    logger.error("Failed to apply weekly patterns", { error });
    return { success: false, applied: 0, error: "Failed to apply weekly patterns. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
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
    .select("date, location, confirmed, user_id, source, time_slot")
    .in("location", [...OFFICE_LOCATIONS])
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  if (!data) {
    return { days: [], error: null };
  }

  // Get unique user IDs for name lookup
  const userIds = [...new Set(data.map((e) => e.user_id))];
  const { data: profiles } = userIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds)
    : { data: [] };

  const nameMap = new Map<string, string>();
  for (const p of profiles ?? []) {
    nameMap.set(p.id, p.full_name ?? "Unknown");
  }

  // Group by date — aggregate by unique user (half-day entries count once per user)
  const dayMap = new Map<string, {
    userSet: Set<string>;
    confirmedSet: Set<string>;
    members: { userId: string; fullName: string; source: string; confirmed: boolean }[];
  }>();

  for (const entry of data) {
    const day = dayMap.get(entry.date) ?? { userSet: new Set(), confirmedSet: new Set(), members: [] };
    if (!day.userSet.has(entry.user_id)) {
      day.userSet.add(entry.user_id);
      day.members.push({
        userId: entry.user_id,
        fullName: nameMap.get(entry.user_id) ?? "Unknown",
        source: entry.source,
        confirmed: entry.confirmed,
      });
    }
    if (entry.confirmed) day.confirmedSet.add(entry.user_id);
    dayMap.set(entry.date, day);
  }

  const days = Array.from(dayMap.entries()).map(([date, day]) => ({
    date,
    scheduled: day.userSet.size,
    confirmed: day.confirmedSet.size,
    members: day.members,
    belowTarget: day.userSet.size < OFFICE_HEADCOUNT_TARGET,
  }));

  return { days, error: null };
}

// =============================================
// DAILY BANNER STATE
// =============================================

/**
 * Get the daily banner state for the current user.
 * Determines which reconciliation banner to show (if any).
 *
 * Returns:
 * - 'office_not_confirmed': User is scheduled for office but hasn't confirmed
 * - 'no_schedule': User has no working location entry for today
 * - null: No banner needed
 */
export async function getDailyBannerState() {
  const { supabase, user } = await getCurrentUser();

  if (!user) return { type: null as string | null };

  const today = getUKToday();

  // Check if user has any working location entries for today (all time slots)
  const { data } = await supabase
    .from("working_locations")
    .select("location, confirmed, time_slot")
    .eq("user_id", user.id)
    .eq("date", today);

  if (!data || data.length === 0) {
    // No schedule set — check if it's before 2pm UK time
    const ukHour = getUKHour();
    if (ukHour < 14) {
      return { type: "no_schedule" as string | null };
    }
    return { type: null as string | null };
  }

  // Check if any entry is for an office location and not confirmed
  const officeLocations = new Set<string>(OFFICE_LOCATIONS);
  const hasUnconfirmedOffice = data.some(
    (entry) => officeLocations.has(entry.location) && !entry.confirmed
  );

  if (hasUnconfirmedOffice) {
    const { hours, minutes } = getUKTime();
    if (hours > 9 || (hours === 9 && minutes >= 30)) {
      return { type: "office_not_confirmed" as string | null };
    }
  }

  return { type: null as string | null };
}

/**
 * Confirm remote arrival — sets confirmed=true for today's office entry.
 * This is the "I'm Here" button in the daily banner (remote confirmation,
 * as opposed to kiosk check-in).
 */
export async function confirmRemoteArrival() {
  const { supabase, user } = await getCurrentUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const today = getUKToday();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("working_locations")
    .update({ confirmed: true, confirmed_at: now })
    .eq("user_id", user.id)
    .eq("date", today)
    .in("location", ["glasgow_office", "stevenage_office"])
    .eq("confirmed", false);

  if (error) {
    logger.error("Failed to confirm remote arrival", { error });
    return { success: false, error: "Failed to confirm arrival. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/sign-in");
  return { success: true, error: null };
}

/**
 * Quick-set today's location from the daily banner.
 * One-click action for "Home", "Glasgow", etc.
 */
export async function quickSetTodayLocation(location: WorkLocation) {
  const today = getUKToday();
  return setWorkingLocation(today, "full_day" as TimeSlot, location);
}

// =============================================
// UK TIME HELPERS (robust Intl.DateTimeFormat)
// =============================================

/** Get the current hour (0-23) in the Europe/London timezone. */
function getUKHour(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const hourPart = parts.find((p) => p.type === "hour");
  return parseInt(hourPart?.value ?? "0", 10);
}

/** Get the current hours and minutes in the Europe/London timezone. */
function getUKTime(): { hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const hours = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minutes = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return { hours, minutes };
}

// =============================================
// LEAVE DATA FOR CALENDAR
// =============================================

/**
 * Get the current user's pending leave requests.
 * Returns requests with status='pending' for display below the calendar.
 */
export async function getMyPendingLeave() {
  const { supabase, user } = await getCurrentUser();

  if (!user) return { requests: [] };

  const { data } = await supabase
    .from("leave_requests")
    .select("id, leave_type, start_date, end_date, start_half_day, end_half_day, total_days, status, created_at")
    .eq("profile_id", user.id)
    .eq("status", "pending")
    .order("start_date", { ascending: true });

  return { requests: data ?? [] };
}

/**
 * Get the current user's approved + pending leave for a date range.
 * Used to show leave entries on the calendar grid.
 */
export async function getMyLeaveForRange(startDate: string, endDate: string) {
  const { supabase, user } = await getCurrentUser();

  if (!user) return { requests: [] };

  const { data } = await supabase
    .from("leave_requests")
    .select("id, leave_type, start_date, end_date, start_half_day, end_half_day, total_days, status, created_at")
    .eq("profile_id", user.id)
    .in("status", ["approved", "pending"])
    .or(`start_date.lte.${endDate},end_date.gte.${startDate}`)
    .order("start_date", { ascending: true });

  return { requests: data ?? [] };
}

/**
 * Get team members' schedule for a specific date.
 * Returns who's where for the day detail panel context.
 */
export async function getTeamContextForDate(date: string) {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile?.is_line_manager) {
    return { members: [] };
  }

  const { data: directReports } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name, avatar_url")
    .eq("line_manager_id", user.id)
    .eq("status", "active")
    .order("full_name");

  if (!directReports || directReports.length === 0) {
    return { members: [] };
  }

  const memberIds = directReports.map((m) => m.id);

  const { data: entries } = await supabase
    .from("working_locations")
    .select("user_id, location, other_location, time_slot, confirmed")
    .in("user_id", memberIds)
    .eq("date", date);

  const entryMap = new Map<string, { location: string; other_location: string | null; confirmed: boolean }>();
  for (const entry of entries ?? []) {
    const existing = entryMap.get(entry.user_id);
    if (!existing || entry.time_slot === "full_day") {
      entryMap.set(entry.user_id, {
        location: entry.location,
        other_location: entry.other_location,
        confirmed: entry.confirmed,
      });
    }
  }

  const members = directReports.map((m) => {
    const entry = entryMap.get(m.id);
    return {
      id: m.id,
      name: m.preferred_name || m.full_name,
      avatarUrl: m.avatar_url,
      location: entry?.location ?? null,
      otherLocation: entry?.other_location ?? null,
      confirmed: entry?.confirmed ?? false,
    };
  });

  return { members };
}

// =============================================
// CALENDAR SYNC
// =============================================

/**
 * Get the current user's calendar sync status.
 */
export async function getCalendarSyncStatus() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { connected: false, lastSynced: null };
  }

  const { data } = await supabase
    .from("profiles")
    .select("calendar_sync_token, calendar_last_synced_at")
    .eq("id", user.id)
    .single();

  if (!data) {
    return { connected: false, lastSynced: null };
  }

  return {
    connected: !!data.calendar_sync_token,
    lastSynced: data.calendar_last_synced_at,
  };
}

/**
 * Manually trigger a calendar sync for the current user.
 * Requires GOOGLE_SERVICE_ACCOUNT_KEY to be configured.
 */
export async function triggerCalendarSync() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return { success: false, error: "Calendar sync not configured" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, calendar_sync_token")
    .eq("id", user.id)
    .single();

  if (!profile?.email) {
    return { success: false, error: "No email address found" };
  }

  try {
    const { syncUserCalendar } = await import("@/lib/calendar-sync");
    const result = await syncUserCalendar({
      id: profile.id,
      email: profile.email,
      calendarSyncToken: profile.calendar_sync_token,
    });

    revalidatePath("/sign-in");

    return {
      success: true,
      upserted: result.upserted,
      deleted: result.deleted,
    };
  } catch (err) {
    logger.error("Calendar sync failed", { error: err instanceof Error ? err.message : String(err) });
    return {
      success: false,
      error: "Calendar sync failed. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
    };
  }
}
