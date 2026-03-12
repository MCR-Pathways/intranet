import { createServiceClient } from "@/lib/supabase/service";
import { fetchWorkingLocations } from "@/lib/google-calendar";
import type { MappedWorkingLocation } from "@/lib/google-calendar";
import { logger } from "@/lib/logger";

// =============================================
// TYPES
// =============================================

interface SyncableUser {
  id: string;
  email: string;
  calendarSyncToken: string | null;
}

export interface SyncStats {
  usersProcessed: number;
  entriesUpserted: number;
  entriesDeleted: number;
  errors: number;
}

// =============================================
// SINGLE USER SYNC
// =============================================

/**
 * Sync working locations from Google Calendar for a single user.
 *
 * Override hierarchy: leave > manual > calendar > pattern.
 * Calendar sync only creates/updates entries with source='calendar'.
 * It never overwrites 'manual' or 'leave' entries.
 */
export async function syncUserCalendar(user: SyncableUser): Promise<{
  upserted: number;
  deleted: number;
  newSyncToken: string | null;
}> {
  const supabase = createServiceClient();

  // Determine sync range for full sync (4 weeks back, 8 weeks forward)
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - 28);
  const rangeEnd = new Date(now);
  rangeEnd.setDate(rangeEnd.getDate() + 56);

  const timeMin = rangeStart.toISOString();
  const timeMax = rangeEnd.toISOString();

  let syncResult = await fetchWorkingLocations(
    user.email,
    user.calendarSyncToken,
    timeMin,
    timeMax,
  );

  // 410 Gone returns empty locations + null syncToken — retry with full sync
  if (user.calendarSyncToken && syncResult.locations.length === 0 && !syncResult.nextSyncToken) {
    logger.info("Re-syncing with full fetch after 410 Gone", { userId: user.id });
    syncResult = await fetchWorkingLocations(user.email, null, timeMin, timeMax);
  }

  const { locations, nextSyncToken } = syncResult;

  if (locations.length === 0 && nextSyncToken) {
    // No changes but got a new sync token — just update it
    await supabase
      .from("profiles")
      .update({
        calendar_sync_token: nextSyncToken,
        calendar_last_synced_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return { upserted: 0, deleted: 0, newSyncToken: nextSyncToken };
  }

  let upserted = 0;
  let deleted = 0;

  // Separate cancelled events (deletions) from active events
  const deletions = locations.filter((l) => l.date === ""); // empty date = cancelled marker
  const upserts = locations.filter((l) => l.date !== "");

  // Handle deletions: remove calendar-sourced entries matching the event ID
  for (const deletion of deletions) {
    const { data } = await supabase
      .from("working_locations")
      .delete()
      .eq("user_id", user.id)
      .eq("google_event_id", deletion.googleEventId)
      .eq("source", "calendar")
      .select("id");

    if (data) {
      deleted += data.length;
    }
  }

  // Handle upserts: only if no manual/leave entry exists for that day/slot
  for (const loc of upserts) {
    const wasUpserted = await upsertCalendarEntry(supabase, user.id, loc);
    if (wasUpserted) upserted++;
  }

  // Update sync token and last synced timestamp (single update)
  const profileUpdate: Record<string, string> = {
    calendar_last_synced_at: new Date().toISOString(),
  };
  if (nextSyncToken) {
    profileUpdate.calendar_sync_token = nextSyncToken;
  }
  await supabase.from("profiles").update(profileUpdate).eq("id", user.id);

  return { upserted, deleted, newSyncToken: nextSyncToken };
}

// =============================================
// UPSERT LOGIC (RESPECTS OVERRIDE HIERARCHY)
// =============================================

/**
 * Upsert a calendar-sourced working location entry.
 * Respects the override hierarchy: leave > manual > calendar > pattern.
 *
 * Returns true if the entry was upserted, false if skipped.
 */
async function upsertCalendarEntry(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  loc: MappedWorkingLocation,
): Promise<boolean> {
  // Check if a manual or leave entry already exists for this day
  const { data: existing } = await supabase
    .from("working_locations")
    .select("id, source")
    .eq("user_id", userId)
    .eq("date", loc.date)
    .eq("time_slot", "full_day");

  if (existing && existing.length > 0) {
    const entry = existing[0];
    // Don't override manual or leave entries
    if (entry.source === "manual" || entry.source === "leave") {
      return false;
    }
    // Calendar or pattern entries can be overwritten by calendar
  }

  const { error } = await supabase
    .from("working_locations")
    .upsert(
      {
        user_id: userId,
        date: loc.date,
        time_slot: "full_day",
        location: loc.location,
        other_location: loc.otherLocation,
        source: "calendar",
        google_event_id: loc.googleEventId,
        confirmed: false,
        confirmed_at: null,
      },
      { onConflict: "user_id,date,time_slot" }
    );

  if (error) {
    logger.error("Failed to upsert calendar entry", {
      userId,
      date: loc.date,
      error: error.message,
    });
    return false;
  }

  return true;
}

// =============================================
// BATCH SYNC (ALL USERS)
// =============================================

/**
 * Sync working locations for all active staff with Google Calendar.
 * Called by the periodic sync job (every 6 hours) or manually.
 */
export async function syncAllUsers(): Promise<SyncStats> {
  const supabase = createServiceClient();

  // Get all active internal staff (they have Google Workspace accounts via @mcrpathways.org)
  // External staff (PCs) are employed by schools — no MCR Google Workspace calendar
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, email, calendar_sync_token")
    .eq("status", "active")
    .in("user_type", ["staff"])
    .eq("is_external", false)
    .not("email", "is", null);

  if (error || !users) {
    logger.error("Failed to fetch users for calendar sync", { error: error?.message });
    return { usersProcessed: 0, entriesUpserted: 0, entriesDeleted: 0, errors: 0 };
  }

  const stats: SyncStats = {
    usersProcessed: 0,
    entriesUpserted: 0,
    entriesDeleted: 0,
    errors: 0,
  };

  // Process users sequentially to avoid API rate limits
  for (const user of users) {
    try {
      const syncUser: SyncableUser = {
        id: user.id,
        email: user.email!,
        calendarSyncToken: user.calendar_sync_token,
      };

      const result = await syncUserCalendar(syncUser);
      stats.usersProcessed++;
      stats.entriesUpserted += result.upserted;
      stats.entriesDeleted += result.deleted;
    } catch (err) {
      stats.errors++;
      logger.error("Calendar sync failed for user", {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("Calendar sync complete", { ...stats });
  return stats;
}
