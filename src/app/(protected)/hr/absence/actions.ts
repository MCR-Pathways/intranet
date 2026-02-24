"use server";

import { getCurrentUser, requireHRAdmin } from "@/lib/auth";
import {
  calculateWorkingDays,
  calculateTriggerPoint,
  getHolidayCalendar,
  ABSENCE_RECORD_SELECT,
  RTW_FORM_SELECT,
  MAX_ABSENCE_DAYS,
  TRIGGER_POINT_WINDOW_MONTHS,
  validateHRDocument,
} from "@/lib/hr";
import type { Region } from "@/lib/hr";
import type { AbsenceType } from "@/types/hr";
import { revalidatePath } from "next/cache";

// =============================================
// ALLOWED FIELDS (whitelist for input sanitisation)
// =============================================

const ABSENCE_ALLOWED_FIELDS = [
  "absence_type",
  "start_date",
  "end_date",
  "reason",
  "sickness_category",
  "leave_request_id",
] as const;

const RTW_ALLOWED_FIELDS = [
  "discussion_date",
  "reason_for_absence",
  "is_work_related",
  "is_pregnancy_related",
  "has_underlying_cause",
  "wellbeing_discussion",
  "medical_advice_details",
  "gp_clearance_received",
  "adjustments_needed",
  "phased_return_agreed",
  "phased_return_details",
  "trigger_point_reached",
  "trigger_point_details",
  "procedures_followed",
  "procedures_not_followed_reason",
  "follow_up_date",
  "additional_notes",
] as const;

const VALID_ABSENCE_TYPES: AbsenceType[] = [
  "sick_self_certified",
  "sick_fit_note",
  "unauthorised",
  "other",
];

const VALID_SICKNESS_CATEGORIES = [
  "cold_flu", "stomach", "headache_migraine", "musculoskeletal",
  "mental_health", "injury", "surgery", "dental",
  "pregnancy_related", "chronic_condition", "covid", "other",
];

// =============================================
// REVALIDATION HELPER
// =============================================

function revalidateAbsencePaths(profileId?: string) {
  revalidatePath("/hr/absence");
  revalidatePath("/hr");
  if (profileId) {
    revalidatePath(`/hr/users/${profileId}`);
  }
}

// =============================================
// AUTHORITY CHECK (shared by RTW actions)
// =============================================

/**
 * Verify the current user can manage an employee's RTW form.
 * Must be the employee's line manager or an HR admin.
 */
async function verifyRTWAuthority(
  supabase: Awaited<ReturnType<typeof getCurrentUser>>["supabase"],
  currentUserId: string,
  employeeId: string,
): Promise<{ authorised: boolean; isHRAdmin: boolean; error?: string }> {
  // Single query to fetch both profiles (avoids sequential round-trips)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, is_hr_admin, line_manager_id")
    .in("id", [currentUserId, employeeId]);

  const currentProfile = profiles?.find((p) => p.id === currentUserId);
  const employeeProfile = profiles?.find((p) => p.id === employeeId);

  if (currentProfile?.is_hr_admin === true) {
    return { authorised: true, isHRAdmin: true };
  }

  if (employeeProfile?.line_manager_id !== currentUserId) {
    return { authorised: false, isHRAdmin: false, error: "You are not authorised to manage this employee's RTW form" };
  }

  return { authorised: true, isHRAdmin: false };
}

// =============================================
// WORKING DAYS HELPER (private)
// =============================================

/**
 * Fetch public holidays for an employee's region and calculate working days
 * between two dates. Used by both recordAbsence and updateAbsence.
 */
async function fetchWorkingDays(
  supabase: Awaited<ReturnType<typeof getCurrentUser>>["supabase"],
  profileId: string,
  startDate: string,
  endDate: string,
): Promise<{ workingDays: number; error: string | null }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("region")
    .eq("id", profileId)
    .single();

  if (!profile) {
    return { workingDays: 0, error: "Employee not found" };
  }

  const region = (profile.region as Region | null) ?? null;
  const calendar = getHolidayCalendar(region);
  const startYear = new Date(startDate + "T00:00:00").getFullYear();
  const endYear = new Date(endDate + "T00:00:00").getFullYear();
  const years = startYear === endYear ? [startYear] : [startYear, endYear];

  const { data: holidayRows } = await supabase
    .from("public_holidays")
    .select("holiday_date")
    .in("region", [calendar, "all"])
    .in("year", years);

  const holidays = (holidayRows ?? []).map((h) => h.holiday_date as string);
  const workingDays = calculateWorkingDays(startDate, endDate, holidays);

  return { workingDays, error: null };
}

// =============================================
// RECORD ABSENCE (HR Admin only)
// =============================================

/**
 * Record a new absence for an employee.
 * Calculates working days automatically based on the employee's region.
 */
export async function recordAbsence(data: {
  profile_id: string;
  absence_type: string;
  start_date: string;
  end_date: string;
  reason?: string;
  sickness_category?: string;
  leave_request_id?: string;
}): Promise<{ success: boolean; error: string | null; absenceId?: string }> {
  const { supabase, user } = await requireHRAdmin();

  // Validate required fields
  if (!data.profile_id || !data.absence_type || !data.start_date || !data.end_date) {
    return { success: false, error: "Missing required fields" };
  }

  // Validate absence type
  if (!VALID_ABSENCE_TYPES.includes(data.absence_type as AbsenceType)) {
    return { success: false, error: "Invalid absence type" };
  }

  // Validate dates
  if (data.end_date < data.start_date) {
    return { success: false, error: "End date cannot be before start date" };
  }

  // Guard against excessively long date ranges
  const diffMs = new Date(data.end_date + "T00:00:00").getTime() - new Date(data.start_date + "T00:00:00").getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > MAX_ABSENCE_DAYS) {
    return { success: false, error: `Absence cannot exceed ${MAX_ABSENCE_DAYS} days. For longer absences, record separate entries.` };
  }

  // Validate sickness category if provided
  if (data.sickness_category && !VALID_SICKNESS_CATEGORIES.includes(data.sickness_category)) {
    return { success: false, error: "Invalid sickness category" };
  }

  // Check for overlapping absences
  const { data: overlapping } = await supabase
    .from("absence_records")
    .select("id")
    .eq("profile_id", data.profile_id)
    .lte("start_date", data.end_date)
    .gte("end_date", data.start_date)
    .limit(1);

  if (overlapping && overlapping.length > 0) {
    return { success: false, error: "This employee already has an absence recorded during this period." };
  }

  // Calculate working days (fetches employee region + public holidays)
  const { workingDays: totalDays, error: wdError } = await fetchWorkingDays(
    supabase, data.profile_id, data.start_date, data.end_date,
  );

  if (wdError) {
    return { success: false, error: wdError };
  }

  if (totalDays <= 0) {
    return { success: false, error: "No working days in the selected date range" };
  }

  const { data: inserted, error } = await supabase
    .from("absence_records")
    .insert({
      profile_id: data.profile_id,
      absence_type: data.absence_type,
      start_date: data.start_date,
      end_date: data.end_date,
      total_days: totalDays,
      reason: data.reason?.trim() || null,
      sickness_category: data.sickness_category || null,
      leave_request_id: data.leave_request_id || null,
      recorded_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateAbsencePaths(data.profile_id);
  return { success: true, error: null, absenceId: inserted.id as string };
}

// =============================================
// UPDATE ABSENCE (HR Admin only)
// =============================================

/**
 * Update an existing absence record.
 * Recalculates total_days if end_date changes.
 */
export async function updateAbsence(
  absenceId: string,
  data: Record<string, unknown>,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase } = await requireHRAdmin();

  // Whitelist fields
  const sanitised: Record<string, unknown> = {};
  for (const key of ABSENCE_ALLOWED_FIELDS) {
    if (key in data && key !== "leave_request_id") {
      sanitised[key] = data[key];
    }
  }

  if (Object.keys(sanitised).length === 0) {
    return { success: false, error: "No valid fields to update" };
  }

  // Validate absence type if changed
  if (sanitised.absence_type && !VALID_ABSENCE_TYPES.includes(sanitised.absence_type as AbsenceType)) {
    return { success: false, error: "Invalid absence type" };
  }

  // Validate sickness category if changed
  if (sanitised.sickness_category && !VALID_SICKNESS_CATEGORIES.includes(sanitised.sickness_category as string)) {
    return { success: false, error: "Invalid sickness category" };
  }

  // If end_date changed, recalculate total_days
  if (sanitised.end_date) {
    const { data: existing } = await supabase
      .from("absence_records")
      .select("profile_id, start_date")
      .eq("id", absenceId)
      .single();

    if (!existing) {
      return { success: false, error: "Absence record not found" };
    }

    const startDate = (sanitised.start_date as string) || (existing.start_date as string);
    const endDate = sanitised.end_date as string;

    if (endDate < startDate) {
      return { success: false, error: "End date cannot be before start date" };
    }

    // Guard against excessively long date ranges
    const diffMs = new Date(endDate + "T00:00:00").getTime() - new Date(startDate + "T00:00:00").getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > MAX_ABSENCE_DAYS) {
      return { success: false, error: `Absence cannot exceed ${MAX_ABSENCE_DAYS} days. For longer absences, record separate entries.` };
    }

    // Check for overlapping absences (excluding this record)
    const { data: overlapping } = await supabase
      .from("absence_records")
      .select("id")
      .eq("profile_id", existing.profile_id as string)
      .neq("id", absenceId)
      .lte("start_date", endDate)
      .gte("end_date", startDate)
      .limit(1);

    if (overlapping && overlapping.length > 0) {
      return { success: false, error: "This employee already has an absence recorded during this period." };
    }

    // Recalculate working days (fetches employee region + public holidays)
    const { workingDays, error: wdError } = await fetchWorkingDays(
      supabase, existing.profile_id as string, startDate, endDate,
    );

    if (wdError) {
      return { success: false, error: wdError };
    }

    sanitised.total_days = workingDays;
  }

  const { data: updated, error } = await supabase
    .from("absence_records")
    .update(sanitised)
    .eq("id", absenceId)
    .select("id, profile_id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateAbsencePaths(updated.profile_id as string);
  return { success: true, error: null };
}

// =============================================
// DELETE ABSENCE (HR Admin only)
// =============================================

/**
 * Delete an absence record.
 * Cascades to return_to_work_forms (ON DELETE CASCADE).
 * Deletes DB record FIRST, then cleans up fit note from storage.
 */
export async function deleteAbsence(
  absenceId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase } = await requireHRAdmin();

  // Fetch record to get file path and profile_id before deletion
  const { data: record } = await supabase
    .from("absence_records")
    .select("id, profile_id, fit_note_path")
    .eq("id", absenceId)
    .single();

  if (!record) {
    return { success: false, error: "Absence record not found" };
  }

  const profileId = record.profile_id as string;
  const fitNotePath = record.fit_note_path as string | null;

  // Delete DB record first (cascades to RTW form)
  const { error } = await supabase
    .from("absence_records")
    .delete()
    .eq("id", absenceId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Clean up fit note from storage (orphaned file is preferable to broken DB reference)
  if (fitNotePath) {
    await supabase.storage.from("hr-documents").remove([fitNotePath]);
  }

  revalidateAbsencePaths(profileId);
  return { success: true, error: null };
}

// =============================================
// UPLOAD FIT NOTE (HR Admin only)
// =============================================

/**
 * Upload a fit note for an absence record.
 * Stores in hr-documents bucket at: fit-notes/{profileId}/{uuid}.{ext}
 */
export async function uploadFitNote(
  formData: FormData,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase } = await requireHRAdmin();

  const absenceId = formData.get("absence_id") as string;
  const profileId = formData.get("profile_id") as string;
  const file = formData.get("file") as File;

  if (!absenceId || !profileId || !file) {
    return { success: false, error: "Missing required fields" };
  }

  // Validate UUID format to prevent path manipulation in storage paths
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(profileId) || !UUID_REGEX.test(absenceId)) {
    return { success: false, error: "Invalid ID format" };
  }

  // Validate file
  const validationError = validateHRDocument({ size: file.size, type: file.type });
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Check for existing fit note (to delete after successful replacement)
  const { data: existing } = await supabase
    .from("absence_records")
    .select("fit_note_path")
    .eq("id", absenceId)
    .single();

  // Generate storage path
  const ext = file.name.split(".").pop() || "pdf";
  const storagePath = `fit-notes/${profileId}/${crypto.randomUUID()}.${ext}`;

  // 1. Upload new file first (before deleting old — prevents data loss if upload fails)
  const { error: uploadError } = await supabase.storage
    .from("hr-documents")
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` };
  }

  // 2. Update absence record with new file reference
  const { error: updateError } = await supabase
    .from("absence_records")
    .update({
      fit_note_path: storagePath,
      fit_note_file_name: file.name,
    })
    .eq("id", absenceId);

  if (updateError) {
    // Rollback: remove newly uploaded file
    await supabase.storage.from("hr-documents").remove([storagePath]);
    return { success: false, error: updateError.message };
  }

  // 3. Delete old file only after everything succeeds (orphaned files are preferable to lost data)
  if (existing?.fit_note_path) {
    await supabase.storage.from("hr-documents").remove([existing.fit_note_path as string]);
  }

  revalidateAbsencePaths(profileId);
  return { success: true, error: null };
}

// =============================================
// DELETE FIT NOTE (HR Admin only)
// =============================================

/**
 * Remove a fit note from an absence record.
 */
export async function deleteFitNote(
  absenceId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase } = await requireHRAdmin();

  const { data: record } = await supabase
    .from("absence_records")
    .select("fit_note_path, profile_id")
    .eq("id", absenceId)
    .single();

  if (!record) {
    return { success: false, error: "Absence record not found" };
  }

  // Clear DB reference first
  const { error } = await supabase
    .from("absence_records")
    .update({ fit_note_path: null, fit_note_file_name: null })
    .eq("id", absenceId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Remove file from storage
  if (record.fit_note_path) {
    await supabase.storage.from("hr-documents").remove([record.fit_note_path as string]);
  }

  revalidateAbsencePaths(record.profile_id as string);
  return { success: true, error: null };
}

// =============================================
// CREATE RTW FORM (Manager / HR Admin)
// =============================================

/**
 * Create a draft RTW form for an absence record.
 * Auto-fills dates from the absence and calculates trigger point status.
 */
export async function createRTWForm(
  absenceId: string,
): Promise<{ success: boolean; error: string | null; formId?: string }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch the absence record
  const { data: absence } = await supabase
    .from("absence_records")
    .select(ABSENCE_RECORD_SELECT)
    .eq("id", absenceId)
    .single();

  if (!absence) {
    return { success: false, error: "Absence record not found" };
  }

  const employeeId = absence.profile_id as string;

  // Verify authority
  const auth = await verifyRTWAuthority(supabase, user.id, employeeId);
  if (!auth.authorised) {
    return { success: false, error: auth.error ?? "Not authorised" };
  }

  // Check no existing RTW form for this absence
  const { data: existingForm } = await supabase
    .from("return_to_work_forms")
    .select("id")
    .eq("absence_record_id", absenceId)
    .maybeSingle();

  if (existingForm) {
    return { success: false, error: "A return-to-work form already exists for this absence", formId: existingForm.id as string };
  }

  // Calculate trigger point from 12-month absence history
  // Use absence end_date as reference for the rolling window
  const rtwWindowStart = new Date(absence.end_date + "T00:00:00");
  rtwWindowStart.setMonth(rtwWindowStart.getMonth() - TRIGGER_POINT_WINDOW_MONTHS);
  const rtwWindowStartStr = rtwWindowStart.toISOString().slice(0, 10);

  const { data: historyRecords } = await supabase
    .from("absence_records")
    .select("start_date, end_date, total_days, absence_type")
    .eq("profile_id", employeeId)
    .gte("end_date", rtwWindowStartStr)
    .neq("id", absenceId); // Exclude the current absence

  const triggerResult = calculateTriggerPoint(
    (historyRecords ?? []).map((r) => ({
      start_date: r.start_date as string,
      end_date: r.end_date as string,
      total_days: Number(r.total_days),
      absence_type: r.absence_type as string,
    })),
    absence.end_date as string,
  );

  // Create the draft form
  const { data: inserted, error } = await supabase
    .from("return_to_work_forms")
    .insert({
      absence_record_id: absenceId,
      employee_id: employeeId,
      completed_by: user.id,
      absence_start_date: absence.start_date,
      absence_end_date: absence.end_date,
      trigger_point_reached: triggerResult.reached,
      trigger_point_details: triggerResult.reason,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateAbsencePaths(employeeId);
  return { success: true, error: null, formId: inserted.id as string };
}

// =============================================
// SAVE RTW FORM (Draft — Manager / HR Admin)
// =============================================

/**
 * Save (partial update) an RTW form in draft state.
 */
export async function saveRTWForm(
  formId: string,
  data: Record<string, unknown>,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch form to check status and ownership
  const { data: form } = await supabase
    .from("return_to_work_forms")
    .select("id, employee_id, completed_by, status")
    .eq("id", formId)
    .single();

  if (!form) {
    return { success: false, error: "RTW form not found" };
  }

  if ((form.status as string) !== "draft") {
    return { success: false, error: "This form is no longer editable. It has been submitted." };
  }

  // Verify authority
  const auth = await verifyRTWAuthority(supabase, user.id, form.employee_id as string);
  if (!auth.authorised) {
    return { success: false, error: auth.error ?? "Not authorised" };
  }

  // Whitelist fields
  const sanitised: Record<string, unknown> = {};
  for (const key of RTW_ALLOWED_FIELDS) {
    if (key in data) {
      sanitised[key] = data[key];
    }
  }

  if (Object.keys(sanitised).length === 0) {
    return { success: false, error: "No valid fields to update" };
  }

  const { error } = await supabase
    .from("return_to_work_forms")
    .update(sanitised)
    .eq("id", formId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateAbsencePaths(form.employee_id as string);
  return { success: true, error: null };
}

// =============================================
// SUBMIT RTW FORM (Draft → Submitted)
// =============================================

/**
 * Submit an RTW form for employee confirmation.
 * Transitions: draft → submitted.
 * Sends a notification to the employee.
 */
export async function submitRTWForm(
  formId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch form
  const { data: form } = await supabase
    .from("return_to_work_forms")
    .select("id, employee_id, completed_by, status, reason_for_absence, absence_record_id")
    .eq("id", formId)
    .single();

  if (!form) {
    return { success: false, error: "RTW form not found" };
  }

  if ((form.status as string) !== "draft") {
    return { success: false, error: "This form has already been submitted" };
  }

  // Verify authority
  const auth = await verifyRTWAuthority(supabase, user.id, form.employee_id as string);
  if (!auth.authorised) {
    return { success: false, error: auth.error ?? "Not authorised" };
  }

  // Validate required fields before submission
  if (!form.reason_for_absence || !(form.reason_for_absence as string).trim()) {
    return { success: false, error: "Reason for absence is required before submitting" };
  }

  // Update status
  const { error: updateError } = await supabase
    .from("return_to_work_forms")
    .update({ status: "submitted" })
    .eq("id", formId)
    .eq("status", "draft") // Guard against race conditions
    .select("id")
    .single();

  if (updateError) {
    return { success: false, error: "Could not submit form. It may have already been submitted." };
  }

  // Send notification to employee
  const employeeId = form.employee_id as string;
  const { error: notifError } = await supabase.from("notifications").insert({
    user_id: employeeId,
    type: "rtw_confirmation_required",
    title: "Return-to-Work Form Ready",
    message: "Your manager has completed a return-to-work form for your recent absence. Please review and confirm.",
    link: `/hr/absence/rtw/${formId}`,
    metadata: { form_id: formId, absence_id: form.absence_record_id },
  });

  if (notifError) {
    // Rollback: revert form status to draft so it can be resubmitted
    await supabase
      .from("return_to_work_forms")
      .update({ status: "draft" })
      .eq("id", formId);
    return { success: false, error: "Form submitted but could not notify the employee. Please try again." };
  }

  revalidateAbsencePaths(employeeId);
  return { success: true, error: null };
}

// =============================================
// CONFIRM RTW FORM (Employee)
// =============================================

/**
 * Employee confirms the RTW form is accurate.
 * Transitions: submitted → locked.
 * Employee can optionally add comments.
 */
export async function confirmRTWForm(
  formId: string,
  employeeComments?: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch form and verify employee ownership
  const { data: form } = await supabase
    .from("return_to_work_forms")
    .select("id, employee_id, status")
    .eq("id", formId)
    .single();

  if (!form) {
    return { success: false, error: "RTW form not found" };
  }

  if ((form.employee_id as string) !== user.id) {
    return { success: false, error: "You can only confirm your own return-to-work form" };
  }

  if ((form.status as string) !== "submitted") {
    return { success: false, error: "This form is not awaiting your confirmation" };
  }

  const { error } = await supabase
    .from("return_to_work_forms")
    .update({
      employee_confirmed: true,
      employee_confirmed_at: new Date().toISOString(),
      employee_comments: employeeComments?.trim() || null,
      status: "locked",
    })
    .eq("id", formId)
    .eq("status", "submitted") // Guard against race conditions
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Could not confirm form. It may have already been processed." };
  }

  revalidateAbsencePaths(form.employee_id as string);
  return { success: true, error: null };
}

// =============================================
// UNLOCK RTW FORM (HR Admin only)
// =============================================

/**
 * Unlock a locked RTW form for corrections.
 * Transitions: locked/confirmed → draft. Clears employee confirmation.
 */
export async function unlockRTWForm(
  formId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase } = await requireHRAdmin();

  const { data: form } = await supabase
    .from("return_to_work_forms")
    .select("id, employee_id, status")
    .eq("id", formId)
    .single();

  if (!form) {
    return { success: false, error: "RTW form not found" };
  }

  if ((form.status as string) !== "locked" && (form.status as string) !== "confirmed" && (form.status as string) !== "submitted") {
    return { success: false, error: "This form is already in draft state" };
  }

  const { error } = await supabase
    .from("return_to_work_forms")
    .update({
      status: "draft",
      employee_confirmed: false,
      employee_confirmed_at: null,
    })
    .eq("id", formId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateAbsencePaths(form.employee_id as string);
  return { success: true, error: null };
}

// =============================================
// FETCH ABSENCE HISTORY (for employee detail tab)
// =============================================

/**
 * Fetch all absence records for a given employee, with RTW form status.
 * Auth: self, line manager, or HR admin (RLS handles access).
 */
export async function fetchAbsenceHistory(
  profileId: string,
): Promise<{ records: Record<string, unknown>[]; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { records: [], error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("absence_records")
    .select(`${ABSENCE_RECORD_SELECT}, return_to_work_forms(id, status)`)
    .eq("profile_id", profileId)
    .order("start_date", { ascending: false });

  if (error) {
    return { records: [], error: error.message };
  }

  return { records: data ?? [], error: null };
}

// =============================================
// FETCH RTW FORM (for viewing/editing)
// =============================================

/**
 * Fetch a single RTW form by ID with joined profile names.
 * Auth: employee, their line manager, or HR admin (RLS handles access).
 */
export async function fetchRTWForm(
  formId: string,
): Promise<{ form: Record<string, unknown> | null; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { form: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("return_to_work_forms")
    .select(`${RTW_FORM_SELECT}, profiles!return_to_work_forms_employee_id_fkey(full_name, avatar_url, job_title), completed_by_profile:profiles!return_to_work_forms_completed_by_fkey(full_name)`)
    .eq("id", formId)
    .single();

  if (error) {
    return { form: null, error: error.message };
  }

  return { form: data, error: null };
}

// =============================================
// FETCH TRIGGER POINT STATUS
// =============================================

/**
 * Calculate trigger point status for an employee based on their absence history.
 * Called when opening the RTW form to display pre-filled trigger point info.
 */
export async function fetchTriggerPointStatus(
  profileId: string,
  excludeAbsenceId?: string,
): Promise<{ result: ReturnType<typeof calculateTriggerPoint>; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { result: { reached: false, spells: 0, days: 0, reason: null }, error: "Not authenticated" };
  }

  // Compute 12-month window from today for the DB-level filter
  const today = new Date().toISOString().slice(0, 10);
  const triggerWindowStart = new Date(today + "T00:00:00");
  triggerWindowStart.setMonth(triggerWindowStart.getMonth() - TRIGGER_POINT_WINDOW_MONTHS);
  const triggerWindowStartStr = triggerWindowStart.toISOString().slice(0, 10);

  let query = supabase
    .from("absence_records")
    .select("start_date, end_date, total_days, absence_type")
    .eq("profile_id", profileId)
    .gte("end_date", triggerWindowStartStr);

  if (excludeAbsenceId) {
    query = query.neq("id", excludeAbsenceId);
  }

  const { data, error } = await query;

  if (error) {
    return { result: { reached: false, spells: 0, days: 0, reason: null }, error: error.message };
  }
  const result = calculateTriggerPoint(
    (data ?? []).map((r) => ({
      start_date: r.start_date as string,
      end_date: r.end_date as string,
      total_days: Number(r.total_days),
      absence_type: r.absence_type as string,
    })),
    today,
  );

  return { result, error: null };
}
