"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { createOOOEvent, deleteOOOEvent } from "@/lib/google-calendar";
import { logger } from "@/lib/logger";

// =============================================
// TYPES
// =============================================

interface LeaveDetails {
  id: string;
  profileId: string;
  startDate: string;
  endDate: string;
  startHalfDay: boolean;
  endHalfDay: boolean;
  leaveType: string;
}

// =============================================
// LEAVE APPROVAL → CREATE WORKING LOCATION ENTRIES
// =============================================

/**
 * Create "on_leave" working location entries for each working day
 * in the approved leave period. Also creates a Google Calendar OOO event.
 *
 * Called after a leave request is approved.
 * Non-critical — failures are logged but don't block the approval.
 */
export async function createLeaveLocationEntries(leave: LeaveDetails): Promise<void> {
  const supabase = createServiceClient();

  try {
    // Generate working days in the leave period
    const workingDays = getWorkingDays(leave.startDate, leave.endDate);

    if (workingDays.length === 0) return;

    // Build entries
    const entries = workingDays.map((date) => {
      let timeSlot: "full_day" | "morning" | "afternoon" = "full_day";

      // Handle half-day leave
      if (date === leave.startDate && leave.startHalfDay) {
        timeSlot = "afternoon"; // Starting half-day = afternoon off
      } else if (date === leave.endDate && leave.endHalfDay) {
        timeSlot = "morning"; // Ending half-day = morning off
      }

      return {
        user_id: leave.profileId,
        date,
        time_slot: timeSlot,
        location: "on_leave" as const,
        other_location: leave.leaveType,
        source: "leave" as const,
        leave_request_id: leave.id,
        confirmed: false,
        confirmed_at: null,
        google_event_id: null,
      };
    });

    // Upsert entries — leave overrides calendar and pattern sources
    // First, delete existing calendar/pattern entries for these dates
    for (const entry of entries) {
      await supabase
        .from("working_locations")
        .delete()
        .eq("user_id", leave.profileId)
        .eq("date", entry.date)
        .eq("time_slot", entry.time_slot)
        .in("source", ["calendar", "pattern"]);
    }

    // Insert leave entries (upsert to handle idempotency)
    const { error } = await supabase
      .from("working_locations")
      .upsert(entries, { onConflict: "user_id,date,time_slot" });

    if (error) {
      logger.error("Failed to create leave location entries", {
        leaveId: leave.id,
        error: error.message,
      });
      return;
    }

    // Create OOO event in Google Calendar
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", leave.profileId)
      .single();

    if (profile?.email) {
      const oooEventId = await createOOOEvent(
        profile.email,
        leave.startDate,
        leave.endDate,
        `Out of Office (${leave.leaveType})`,
      );

      if (oooEventId) {
        // Store the OOO event ID on the leave request for later deletion
        await supabase
          .from("leave_requests")
          .update({ ooo_calendar_event_id: oooEventId })
          .eq("id", leave.id);
      }
    }

    logger.info("Created leave location entries", {
      leaveId: leave.id,
      count: entries.length,
    });
  } catch (error) {
    logger.error("Failed to create leave location entries", {
      leaveId: leave.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// =============================================
// LEAVE CANCELLATION → DELETE ENTRIES
// =============================================

/**
 * Delete "on_leave" working location entries for a cancelled leave request.
 * Also deletes the Google Calendar OOO event if one was created.
 *
 * Called after a leave request is cancelled.
 * Non-critical — failures are logged but don't block the cancellation.
 */
export async function deleteLeaveLocationEntries(
  leaveRequestId: string,
  profileId: string,
): Promise<void> {
  const supabase = createServiceClient();

  try {
    // Delete working_locations entries linked to this leave request
    const { error } = await supabase
      .from("working_locations")
      .delete()
      .eq("leave_request_id", leaveRequestId)
      .eq("user_id", profileId);

    if (error) {
      logger.error("Failed to delete leave location entries", {
        leaveRequestId,
        error: error.message,
      });
    }

    // Delete the OOO Calendar event if one exists
    const { data: request } = await supabase
      .from("leave_requests")
      .select("ooo_calendar_event_id")
      .eq("id", leaveRequestId)
      .single();

    if (request?.ooo_calendar_event_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", profileId)
        .single();

      if (profile?.email) {
        await deleteOOOEvent(profile.email, request.ooo_calendar_event_id);

        // Clear the stored event ID
        await supabase
          .from("leave_requests")
          .update({ ooo_calendar_event_id: null })
          .eq("id", leaveRequestId);
      }
    }

    logger.info("Deleted leave location entries", { leaveRequestId });
  } catch (error) {
    logger.error("Failed to delete leave location entries", {
      leaveRequestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// =============================================
// HELPERS
// =============================================

/**
 * Get all working days (Mon-Fri) between two dates, inclusive.
 */
function getWorkingDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const start = new Date(startDate + "T12:00:00Z");
  const end = new Date(endDate + "T12:00:00Z");

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Skip weekends
      days.push(d.toISOString().split("T")[0]);
    }
  }

  return days;
}
