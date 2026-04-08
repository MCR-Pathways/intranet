"use server";

import { getCurrentUser, requireHRAdmin } from "@/lib/auth";
import {
  REQUESTABLE_LEAVE_TYPES,
  LEAVE_TYPE_CONFIG,
  calculateWorkingDays,
  getLeaveYearForDate,
  getHolidayCalendar,
} from "@/lib/hr";
import type { LeaveType, Region } from "@/lib/hr";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { validateTextLength, MAX_MEDIUM_TEXT_LENGTH } from "@/lib/validation";
import { sendAndLogEmail } from "@/lib/email-queue";
import { baseTemplate, escapeHtml } from "@/lib/email";
import { formatDate } from "@/lib/utils";

// =============================================
// SELECT CONSTANTS
// =============================================

const PUBLIC_HOLIDAY_SELECT = "id, name, holiday_date, region";

// =============================================
// FETCH PUBLIC HOLIDAYS
// =============================================

/**
 * Fetch public holidays for a given calendar (scotland/england) and year.
 * Returns an array of date strings (YYYY-MM-DD).
 */
export async function fetchPublicHolidays(
  region: Region | null,
  year?: number
): Promise<string[]> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return [];

  const calendar = getHolidayCalendar(region);
  const targetYear = year ?? new Date().getFullYear();

  const { data } = await supabase
    .from("public_holidays")
    .select(PUBLIC_HOLIDAY_SELECT)
    .in("region", [calendar, "all"])
    .eq("year", targetYear)
    .order("holiday_date");

  return (data ?? []).map((h) => h.holiday_date as string);
}

// =============================================
// REQUEST LEAVE (Employee self-service)
// =============================================

/**
 * Create a new leave request for the current user.
 * Only requestable leave types are allowed for self-service.
 */
export async function requestLeave(data: {
  leave_type: string;
  start_date: string;
  end_date: string;
  start_half_day?: boolean;
  end_half_day?: boolean;
  reason?: string;
}) {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Validate leave type
  if (!REQUESTABLE_LEAVE_TYPES.includes(data.leave_type as LeaveType)) {
    return { success: false, error: "Invalid leave type for self-service request" };
  }

  // Validate text lengths
  if (data.reason) {
    const reasonErr = validateTextLength(data.reason, MAX_MEDIUM_TEXT_LENGTH);
    if (reasonErr) return { success: false, error: reasonErr };
  }

  // Validate dates
  if (!data.start_date || !data.end_date) {
    return { success: false, error: "Start and end dates are required" };
  }
  if (data.end_date < data.start_date) {
    return { success: false, error: "End date cannot be before start date" };
  }

  // Fetch employee region for public holiday lookup
  const { data: profile } = await supabase
    .from("profiles")
    .select("region, fte")
    .eq("id", user.id)
    .single();

  const region = (profile?.region as Region | null) ?? null;
  const holidays = await fetchPublicHolidays(region);

  // Calculate working days
  const totalDays = calculateWorkingDays(
    data.start_date,
    data.end_date,
    holidays,
    data.start_half_day ?? false,
    data.end_half_day ?? false
  );

  if (totalDays <= 0) {
    return { success: false, error: "No working days in the selected date range" };
  }

  const { error } = await supabase.from("leave_requests").insert({
    profile_id: user.id,
    leave_type: data.leave_type,
    start_date: data.start_date,
    end_date: data.end_date,
    start_half_day: data.start_half_day ?? false,
    end_half_day: data.end_half_day ?? false,
    total_days: totalDays,
    reason: data.reason?.trim() || null,
    status: "pending",
  });

  if (error) {
    logger.error("Failed to request leave", { error });
    return { success: false, error: "Failed to submit leave request. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/leave");
  revalidatePath("/hr/calendar");
  revalidatePath("/hr");
  return { success: true, error: null };
}

// =============================================
// WITHDRAW LEAVE (Employee)
// =============================================

/**
 * Withdraw a pending leave request. Only the request owner can withdraw.
 */
export async function withdrawLeave(requestId: string) {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "withdrawn" })
    .eq("id", requestId)
    .eq("profile_id", user.id)
    .eq("status", "pending")
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Could not withdraw request. It may have already been decided." };
  }

  revalidatePath("/hr/leave");
  revalidatePath("/hr/calendar");
  revalidatePath("/hr");
  return { success: true, error: null };
}

// =============================================
// AUTHORITY CHECK (shared by approve + reject)
// =============================================

/**
 * Verify the current user is authorised to approve/reject a leave request.
 * Must be the requester's line manager or an HR admin.
 */
async function verifyLeaveDecisionAuthority(
  supabase: Awaited<ReturnType<typeof getCurrentUser>>["supabase"],
  userId: string,
  requesterId: string,
): Promise<{ authorised: boolean; error?: string }> {
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("is_hr_admin")
    .eq("id", userId)
    .single();

  if (currentProfile?.is_hr_admin === true) {
    return { authorised: true };
  }

  const { data: requesterProfile } = await supabase
    .from("profiles")
    .select("line_manager_id")
    .eq("id", requesterId)
    .single();

  if (requesterProfile?.line_manager_id !== userId) {
    return { authorised: false, error: "You are not authorised to action this request" };
  }

  return { authorised: true };
}

// =============================================
// APPROVE LEAVE (Manager / HR Admin)
// =============================================

/**
 * Approve a pending leave request.
 * Must be the requester's line manager or an HR admin.
 */
export async function approveLeave(requestId: string, notes?: string) {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  if (notes) {
    const notesErr = validateTextLength(notes, MAX_MEDIUM_TEXT_LENGTH);
    if (notesErr) return { success: false, error: notesErr };
  }

  // Fetch the request to check ownership and dates for leave integration
  const { data: request } = await supabase
    .from("leave_requests")
    .select("id, profile_id, status, start_date, end_date, start_half_day, end_half_day, leave_type")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "pending") {
    return { success: false, error: "Request not found or not pending" };
  }

  const auth = await verifyLeaveDecisionAuthority(supabase, user.id, request.profile_id);
  if (!auth.authorised) {
    return { success: false, error: auth.error! };
  }

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: "approved",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decision_notes: notes?.trim() || null,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to approve leave", { error });
    return { success: false, error: "Failed to approve leave request. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  // Create "on_leave" working location entries + OOO Calendar event (non-blocking)
  try {
    const { createLeaveLocationEntries } = await import("@/lib/leave-location-sync");
    await createLeaveLocationEntries({
      id: request.id,
      profileId: request.profile_id,
      startDate: request.start_date,
      endDate: request.end_date,
      startHalfDay: request.start_half_day,
      endHalfDay: request.end_half_day,
      leaveType: request.leave_type,
    });
  } catch (err) {
    // Non-critical — log but don't block the approval
    logger.warn("Failed to create leave location entries", { requestId, error: err instanceof Error ? err.message : String(err) });
  }

  // Queue leave decision email (non-blocking)
  try {
    const { data: requester } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", request.profile_id)
      .single();

    if (requester) {
      const leaveLabel = (LEAVE_TYPE_CONFIG[request.leave_type as LeaveType]?.label ?? request.leave_type).toLowerCase();
      const safeName = escapeHtml(requester.full_name);
      const subject = `Leave approved: ${leaveLabel} ${formatDate(new Date(request.start_date))} – ${formatDate(new Date(request.end_date))}`;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.mcrpathways.org";
      const html = baseTemplate(
        "Leave Approved",
        `<h2 style="color: #166534; font-size: 18px; margin: 0 0 8px;">Leave Approved</h2>
         <p style="font-size: 14px; color: #213350;">Your ${escapeHtml(leaveLabel)} request has been <strong style="color: #166534;">approved</strong>.</p>
         <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #bbf7d0;">
           <p style="font-size: 14px; color: #166534; margin: 0;">${formatDate(new Date(request.start_date))} – ${formatDate(new Date(request.end_date))}</p>
           ${notes ? `<p style="font-size: 13px; color: #6b7280; margin: 8px 0 0;">Note: ${escapeHtml(notes)}</p>` : ""}
         </div>
         <a href="${appUrl}/hr/leave" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; border: 2px solid #213350; text-decoration: none; font-size: 14px; font-weight: 500;">View Leave →</a>`,
        { preheader: `Your ${leaveLabel} has been approved` }
      );

      await sendAndLogEmail({
        userId: requester.id,
        email: requester.email,
        emailType: "leave_decision",
        subject,
        bodyHtml: html,
        entityId: requestId,
        entityType: "leave_request",
      });
    }
  } catch (emailErr) {
    logger.error("Failed to queue leave approval email", { error: emailErr });
  }

  revalidatePath("/hr/leave");
  revalidatePath("/hr/calendar");
  revalidatePath("/hr");
  revalidatePath("/sign-in");
  revalidatePath(`/hr/users/${request.profile_id}`);
  return { success: true, error: null };
}

// =============================================
// REJECT LEAVE (Manager / HR Admin)
// =============================================

/**
 * Reject a pending leave request. Reason is required.
 */
export async function rejectLeave(requestId: string, reason: string) {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  if (!reason?.trim()) {
    return { success: false, error: "A reason is required when rejecting leave" };
  }

  const reasonErr = validateTextLength(reason, MAX_MEDIUM_TEXT_LENGTH);
  if (reasonErr) return { success: false, error: reasonErr };

  // Fetch the request
  const { data: request } = await supabase
    .from("leave_requests")
    .select("id, profile_id, status, leave_type, start_date, end_date")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "pending") {
    return { success: false, error: "Request not found or not pending" };
  }

  const auth = await verifyLeaveDecisionAuthority(supabase, user.id, request.profile_id);
  if (!auth.authorised) {
    return { success: false, error: auth.error! };
  }

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: "rejected",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      rejection_reason: reason.trim(),
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to reject leave", { error });
    return { success: false, error: "Failed to reject leave request. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  // Queue leave rejection email (non-blocking)
  try {
    const { data: requester } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", request.profile_id)
      .single();

    if (requester) {
      const safeName = escapeHtml(requester.full_name);
      const leaveLabel = (LEAVE_TYPE_CONFIG[request.leave_type as LeaveType]?.label ?? request.leave_type).toLowerCase();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.mcrpathways.org";
      const subject = `Leave request declined: ${leaveLabel} ${formatDate(new Date(request.start_date))} – ${formatDate(new Date(request.end_date))}`;
      const html = baseTemplate(
        "Leave Declined",
        `<h2 style="color: #dc2626; font-size: 18px; margin: 0 0 8px;">Leave Request Declined</h2>
         <p style="font-size: 14px; color: #213350;">Your ${escapeHtml(leaveLabel)} request for <strong>${formatDate(new Date(request.start_date))} – ${formatDate(new Date(request.end_date))}</strong> has been <strong style="color: #dc2626;">declined</strong>.</p>
         <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #fecaca;">
           <p style="font-size: 14px; color: #991b1b; margin: 0;">Reason: ${escapeHtml(reason.trim())}</p>
         </div>
         <p style="font-size: 13px; color: #6b7280;">Please speak to your line manager if you have any questions.</p>
         <a href="${appUrl}/hr/leave" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; border: 2px solid #213350; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 8px;">View Leave →</a>`,
        { preheader: `Your ${leaveLabel} request was declined` }
      );

      await sendAndLogEmail({
        userId: requester.id,
        email: requester.email,
        emailType: "leave_decision",
        subject,
        bodyHtml: html,
        entityId: requestId,
        entityType: "leave_request",
      });
    }
  } catch (emailErr) {
    logger.error("Failed to queue leave rejection email", { error: emailErr });
  }

  revalidatePath("/hr/leave");
  revalidatePath("/hr/calendar");
  revalidatePath("/hr");
  revalidatePath(`/hr/users/${request.profile_id}`);
  return { success: true, error: null };
}

// =============================================
// CANCEL LEAVE (HR Admin only)
// =============================================

/**
 * Cancel an approved leave request. HR admin only.
 */
export async function cancelLeave(requestId: string) {
  const { supabase, user } = await requireHRAdmin();

  const { data: request } = await supabase
    .from("leave_requests")
    .select("id, profile_id, status")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "approved") {
    return { success: false, error: "Request not found or not in approved state" };
  }

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: "cancelled",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decision_notes: "Leave cancelled by HR admin",
    })
    .eq("id", requestId)
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to cancel leave", { error });
    return { success: false, error: "Failed to cancel leave request. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  // Delete "on_leave" working location entries + OOO Calendar event (non-blocking)
  try {
    const { deleteLeaveLocationEntries } = await import("@/lib/leave-location-sync");
    await deleteLeaveLocationEntries(requestId, request.profile_id);
  } catch (err) {
    logger.warn("Failed to delete leave location entries", { requestId, error: err instanceof Error ? err.message : String(err) });
  }

  revalidatePath("/hr/leave");
  revalidatePath("/hr/calendar");
  revalidatePath("/hr");
  revalidatePath("/sign-in");
  revalidatePath(`/hr/users/${request.profile_id}`);
  return { success: true, error: null };
}

// =============================================
// RECORD LEAVE (HR Admin on behalf of employee)
// =============================================

/**
 * Record leave on behalf of an employee. HR admin only.
 * Used for HR-only leave types (sick, maternity, etc.) or to
 * manually record any type. Automatically set to approved status.
 */
export async function recordLeave(data: {
  profile_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  start_half_day?: boolean;
  end_half_day?: boolean;
  reason?: string;
  notes?: string;
}) {
  const { supabase, user } = await requireHRAdmin();

  if (!data.profile_id || !data.leave_type || !data.start_date || !data.end_date) {
    return { success: false, error: "Employee, leave type, and dates are required" };
  }

  if (!(data.leave_type in LEAVE_TYPE_CONFIG)) {
    return { success: false, error: "Invalid leave type. Please select a valid option." };
  }

  if (data.end_date < data.start_date) {
    return { success: false, error: "End date cannot be before start date" };
  }

  // Validate text lengths
  for (const value of [data.reason, data.notes]) {
    if (value) {
      const err = validateTextLength(value, MAX_MEDIUM_TEXT_LENGTH);
      if (err) return { success: false, error: err };
    }
  }

  // Fetch employee region for working day calculation
  const { data: profile } = await supabase
    .from("profiles")
    .select("region")
    .eq("id", data.profile_id)
    .single();

  const region = (profile?.region as Region | null) ?? null;
  const holidays = await fetchPublicHolidays(region);

  const totalDays = calculateWorkingDays(
    data.start_date,
    data.end_date,
    holidays,
    data.start_half_day ?? false,
    data.end_half_day ?? false
  );

  if (totalDays <= 0) {
    return { success: false, error: "No working days in the selected date range" };
  }

  const { data: insertedRequest, error } = await supabase
    .from("leave_requests")
    .insert({
      profile_id: data.profile_id,
      leave_type: data.leave_type,
      start_date: data.start_date,
      end_date: data.end_date,
      start_half_day: data.start_half_day ?? false,
      end_half_day: data.end_half_day ?? false,
      total_days: totalDays,
      reason: data.reason?.trim() || null,
      status: "approved",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decision_notes: data.notes?.trim() || "Recorded by HR admin",
    })
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to record leave", { error });
    return { success: false, error: "Failed to record leave. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  // Create "on_leave" working location entries + OOO Calendar event (non-blocking)
  if (insertedRequest) {
    try {
      const { createLeaveLocationEntries } = await import("@/lib/leave-location-sync");
      await createLeaveLocationEntries({
        id: insertedRequest.id,
        profileId: data.profile_id,
        startDate: data.start_date,
        endDate: data.end_date,
        startHalfDay: data.start_half_day ?? false,
        endHalfDay: data.end_half_day ?? false,
        leaveType: data.leave_type,
      });
    } catch (err) {
      logger.warn("Failed to create leave location entries", { leaveId: insertedRequest.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  revalidatePath("/hr/leave");
  revalidatePath("/hr/calendar");
  revalidatePath("/hr");
  revalidatePath("/sign-in");
  revalidatePath(`/hr/users/${data.profile_id}`);
  return { success: true, error: null };
}

// =============================================
// UPSERT LEAVE ENTITLEMENT (HR Admin)
// =============================================

/**
 * Set or update a leave entitlement for an employee.
 * HR admin only. Upserts on (profile_id, leave_year_start, leave_type).
 */
export async function upsertLeaveEntitlement(data: {
  profile_id: string;
  leave_type: string;
  leave_year_start?: string;
  leave_year_end?: string;
  base_entitlement_days: number;
  fte_at_calculation: number;
  adjustments_days?: number;
  notes?: string;
}) {
  const { supabase } = await requireHRAdmin();

  const leaveYear = getLeaveYearForDate();
  const yearStart = data.leave_year_start ?? leaveYear.start;
  const yearEnd = data.leave_year_end ?? leaveYear.end;

  if (data.base_entitlement_days < 0) {
    return { success: false, error: "Base entitlement cannot be negative" };
  }

  if (data.notes) {
    const notesErr = validateTextLength(data.notes, MAX_MEDIUM_TEXT_LENGTH);
    if (notesErr) return { success: false, error: notesErr };
  }

  const { error } = await supabase.from("leave_entitlements").upsert(
    {
      profile_id: data.profile_id,
      leave_year_start: yearStart,
      leave_year_end: yearEnd,
      leave_type: data.leave_type,
      base_entitlement_days: data.base_entitlement_days,
      fte_at_calculation: data.fte_at_calculation,
      adjustments_days: data.adjustments_days ?? 0,
      notes: data.notes?.trim() || null,
    },
    { onConflict: "profile_id,leave_year_start,leave_type" }
  );

  if (error) {
    logger.error("Failed to upsert leave entitlement", { error });
    return { success: false, error: "Failed to update leave entitlement. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/leave");
  revalidatePath(`/hr/users/${data.profile_id}`);
  return { success: true, error: null };
}
