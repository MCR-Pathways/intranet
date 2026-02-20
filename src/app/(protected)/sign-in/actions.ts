"use server";

import { getCurrentUser } from "@/lib/auth";
import { createNotification, dismissSignInReminders } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import type { WorkLocation } from "@/types/database.types";

const VALID_LOCATIONS: WorkLocation[] = [
  "home",
  "glasgow_office",
  "stevenage_office",
  "other",
];

/**
 * Get today's date string (YYYY-MM-DD) in UK timezone (Europe/London).
 * Prevents UTC midnight edge-case: e.g. 11:30 PM BST should still be "today" not "tomorrow".
 */
function getUKToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

/**
 * Record a new working location entry.
 * Multiple entries per day are allowed (e.g. morning at home, afternoon at office).
 * On the first entry of the day, updates the denormalized last_sign_in_date
 * and dismisses any pending sign-in reminder notifications.
 */
export async function recordSignIn(
  location: string,
  otherLocation?: string
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Validate location against whitelist
  if (!VALID_LOCATIONS.includes(location as WorkLocation)) {
    return { success: false, error: "Invalid location" };
  }

  // Sanitize other_location
  const sanitizedOtherLocation =
    location === "other" ? (otherLocation?.trim().slice(0, 200) || null) : null;

  if (location === "other" && !sanitizedOtherLocation) {
    return { success: false, error: "Please specify your location" };
  }

  const today = getUKToday();

  // Check if this will be the first sign-in of the day (before inserting)
  const { data: existingToday } = await supabase
    .from("sign_ins")
    .select("id")
    .eq("user_id", user.id)
    .eq("sign_in_date", today)
    .limit(1);

  const isFirstOfDay = !existingToday || existingToday.length === 0;

  // INSERT new entry (not upsert — multiple entries per day allowed)
  const { error: signInError } = await supabase.from("sign_ins").insert({
    user_id: user.id,
    sign_in_date: today,
    location,
    other_location: sanitizedOtherLocation,
    signed_in_at: new Date().toISOString(),
  });

  if (signInError) {
    return { success: false, error: signInError.message };
  }

  // On first entry of the day: update denorm column and dismiss notifications
  if (isFirstOfDay) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ last_sign_in_date: today })
      .eq("id", user.id);

    if (profileError) {
      logger.error("Failed to update last_sign_in_date", { error: profileError.message });
    }

    try {
      await dismissSignInReminders(user.id);
    } catch (e) {
      logger.error("Failed to dismiss sign-in reminders", { error: e });
    }
  }

  revalidatePath("/sign-in");
  revalidatePath("/", "layout");
  return { success: true, error: null };
}

/**
 * Get all of the current user's sign-in entries for today.
 * Returns an array ordered by signed_in_at ascending (earliest first).
 */
export async function getTodaySignIns() {
  const { supabase, user } = await getCurrentUser();

  if (!user) return [];

  const today = getUKToday();

  const { data } = await supabase
    .from("sign_ins")
    .select("id, sign_in_date, location, other_location, signed_in_at, created_at")
    .eq("user_id", user.id)
    .eq("sign_in_date", today)
    .order("signed_in_at", { ascending: true });

  return data ?? [];
}

/**
 * Get the current user's sign-in history for the past 30 days.
 * Returns entries ordered by sign_in_date DESC, signed_in_at ASC.
 * Grouping by date is done on the client side.
 */
export async function getMonthlyHistory() {
  const { supabase, user } = await getCurrentUser();

  if (!user) return [];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toLocaleDateString("en-CA", { timeZone: "Europe/London" });

  const { data } = await supabase
    .from("sign_ins")
    .select("id, sign_in_date, location, other_location, signed_in_at")
    .eq("user_id", user.id)
    .gte("sign_in_date", startDate)
    .order("sign_in_date", { ascending: false })
    .order("signed_in_at", { ascending: true });

  return data ?? [];
}

/**
 * Delete a sign-in entry by ID. Users can only delete their own entries.
 */
export async function deleteSignInEntry(
  entryId: string
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Delete with user_id check for defence-in-depth on top of RLS
  const { error } = await supabase
    .from("sign_ins")
    .delete()
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  // If this was the last entry for today, clear last_sign_in_date so
  // the sign-in nudge reappears on next page load.
  const today = getUKToday();
  const { data: remaining } = await supabase
    .from("sign_ins")
    .select("id")
    .eq("user_id", user.id)
    .eq("sign_in_date", today)
    .limit(1);

  if (!remaining || remaining.length === 0) {
    await supabase
      .from("profiles")
      .update({ last_sign_in_date: null })
      .eq("id", user.id);
  }

  revalidatePath("/sign-in");
  revalidatePath("/", "layout");
  return { success: true, error: null };
}

/**
 * Get today's sign-in status for the manager's direct reports.
 * Each member maps to an array of sign-in entries (multiple per day).
 * Only accessible by line managers.
 */
export async function getTeamSignInsToday() {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile?.is_line_manager) {
    return { members: [], error: "Unauthorised" };
  }

  const today = getUKToday();

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

  // Get today's sign-ins for those members
  const { data: signIns } = await supabase
    .from("sign_ins")
    .select("user_id, location, other_location, signed_in_at")
    .in("user_id", memberIds)
    .eq("sign_in_date", today)
    .order("signed_in_at", { ascending: true });

  // Build map: user_id -> array of sign-ins
  const signInMap = new Map<
    string,
    { user_id: string; location: string; other_location: string | null; signed_in_at: string }[]
  >();
  for (const s of signIns ?? []) {
    const arr = signInMap.get(s.user_id) ?? [];
    arr.push(s);
    signInMap.set(s.user_id, arr);
  }

  const membersWithSignIns = members.map((member) => ({
    ...member,
    sign_ins: signInMap.get(member.id) ?? [],
  }));

  return { members: membersWithSignIns, error: null };
}

/**
 * Get historical sign-in data for the manager's direct reports.
 * Supports date range filtering for reporting.
 */
export async function getTeamSignInHistory(filters: {
  startDate?: string;
  endDate?: string;
}) {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile?.is_line_manager) {
    return { data: [], members: [], error: "Unauthorised", truncated: false };
  }

  // Get active direct reports
  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name, avatar_url, job_title")
    .eq("line_manager_id", user.id)
    .eq("status", "active")
    .order("full_name");

  if (!members || members.length === 0) {
    return { data: [], members: [], error: null, truncated: false };
  }

  const memberIds = members.map((m) => m.id);

  // Build query with optional date filters
  let query = supabase
    .from("sign_ins")
    .select("id, user_id, sign_in_date, location, other_location, signed_in_at")
    .in("user_id", memberIds)
    .order("sign_in_date", { ascending: false })
    .order("signed_in_at", { ascending: true });

  if (filters.startDate) {
    query = query.gte("sign_in_date", filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte("sign_in_date", filters.endDate);
  }

  const QUERY_LIMIT = 1000;
  const { data: signIns, error } = await query.limit(QUERY_LIMIT);

  if (error) {
    return { data: [], members: [], error: error.message, truncated: false };
  }

  const results = signIns ?? [];

  return {
    data: results,
    members: members ?? [],
    error: null,
    truncated: results.length >= QUERY_LIMIT,
  };
}

/**
 * Check if a staff user needs a sign-in nudge and create a notification if so.
 * Called from the protected layout on each page load.
 * Returns true if the user should see the sign-in banner.
 *
 * This is idempotent — it only creates one notification per day
 * (checks for existing unread reminder before creating).
 */
export async function checkAndCreateSignInNudge(): Promise<boolean> {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile) return false;
  if (profile.user_type !== "staff") return false;

  const today = getUKToday();
  if (profile.last_sign_in_date === today) return false;

  // User hasn't signed in today — check for existing unread reminder
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", "sign_in_reminder")
    .eq("is_read", false)
    .limit(1);

  if (!existing || existing.length === 0) {
    // Create notification (only once per day — idempotent)
    try {
      await createNotification({
        userId: user.id,
        type: "sign_in_reminder",
        title: "Where are you working today?",
        message: "Please record your working location for today.",
        link: "/sign-in",
      });
    } catch (e) {
      logger.error("Failed to create sign-in nudge notification", { error: e });
    }
  }

  return true;
}
