"use server";

import { getCurrentUser, requireHRAdmin } from "@/lib/auth";
import {
  STAFF_LEAVING_FORM_SELECT,
  getLeaveYearForDate,
  formatHRDate,
} from "@/lib/hr";
import type { LeavingReason } from "@/lib/hr";
import { revalidatePath } from "next/cache";

// =============================================
// ALLOWED FIELDS (whitelist for input sanitisation)
// =============================================

const LEAVING_FORM_ALLOWED_FIELDS = [
  "leaving_date",
  "last_working_date",
  "reason_for_leaving",
  "reason_details",
  "notice_period_start",
  "notice_period_end",
  "exit_interview_completed",
  "exit_interview_notes",
  "knowledge_transfer_completed",
  "knowledge_transfer_notes",
  "equipment_returned",
  "equipment_notes",
  "access_revoked",
  "access_revoked_date",
  "final_leave_balance",
  "rehire_eligible",
  "additional_notes",
] as const;

const VALID_LEAVING_REASONS: LeavingReason[] = [
  "resignation",
  "redundancy",
  "end_of_contract",
  "retirement",
  "dismissal",
  "mutual_agreement",
  "other",
];

// =============================================
// REVALIDATION HELPER
// =============================================

function revalidateLeavingPaths(profileId?: string) {
  revalidatePath("/hr/leaving");
  revalidatePath("/hr");
  if (profileId) {
    revalidatePath(`/hr/users/${profileId}`);
  }
}

// =============================================
// AUTHORITY CHECK (manager or HR admin)
// =============================================

/**
 * Verify the current user can manage an employee's leaving form.
 * Must be the employee's line manager or an HR admin.
 */
async function verifyLeavingAuthority(
  supabase: Awaited<ReturnType<typeof getCurrentUser>>["supabase"],
  currentUserId: string,
  employeeId: string,
): Promise<{ authorised: boolean; isHRAdmin: boolean; error?: string }> {
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
    return {
      authorised: false,
      isHRAdmin: false,
      error: "You are not authorised to manage this employee's leaving form",
    };
  }

  return { authorised: true, isHRAdmin: false };
}

// =============================================
// SANITISE INPUT
// =============================================

function sanitiseLeavingFields(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const sanitised: Record<string, unknown> = {};
  for (const field of LEAVING_FORM_ALLOWED_FIELDS) {
    if (field in data) {
      sanitised[field] = data[field];
    }
  }
  return sanitised;
}

// =============================================
// CREATE LEAVING FORM
// =============================================

export async function createLeavingForm(data: {
  profile_id: string;
  leaving_date: string;
  reason_for_leaving: string;
  reason_details?: string;
}): Promise<{ success: boolean; error: string | null; formId?: string }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Validate inputs
  if (!data.profile_id || !data.leaving_date || !data.reason_for_leaving) {
    return { success: false, error: "Employee, leaving date, and reason are required" };
  }

  if (!VALID_LEAVING_REASONS.includes(data.reason_for_leaving as LeavingReason)) {
    return { success: false, error: "Invalid leaving reason" };
  }

  // Verify authority
  const auth = await verifyLeavingAuthority(supabase, user.id, data.profile_id);
  if (!auth.authorised) {
    return { success: false, error: auth.error ?? "Not authorised" };
  }

  // Auto-calculate final leave balance (using leaving date to pick correct leave year)
  const leaveBalance = await calculateFinalLeaveBalance(
    supabase,
    data.profile_id,
    data.leaving_date,
  );

  // Insert the form
  const { data: form, error: insertError } = await supabase
    .from("staff_leaving_forms")
    .insert({
      profile_id: data.profile_id,
      initiated_by: user.id,
      leaving_date: data.leaving_date,
      reason_for_leaving: data.reason_for_leaving,
      reason_details: data.reason_details?.trim() || null,
      final_leave_balance: leaveBalance,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertError) {
    // Check for unique constraint violation (one active form per person)
    if (insertError.code === "23505") {
      return {
        success: false,
        error: "This employee already has an active leaving form. Cancel it first to create a new one.",
      };
    }
    return { success: false, error: `Failed to create leaving form: ${insertError.message}` };
  }

  revalidateLeavingPaths(data.profile_id);
  return { success: true, error: null, formId: form.id as string };
}

// =============================================
// UPDATE LEAVING FORM
// =============================================

export async function updateLeavingForm(
  formId: string,
  data: Record<string, unknown>,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch form to verify ownership and status
  const { data: form } = await supabase
    .from("staff_leaving_forms")
    .select("id, profile_id, status")
    .eq("id", formId)
    .single();

  if (!form) {
    return { success: false, error: "Leaving form not found" };
  }

  const status = form.status as string;
  if (!["draft", "submitted", "in_progress"].includes(status)) {
    return { success: false, error: "This form can no longer be edited" };
  }

  // Verify authority
  const auth = await verifyLeavingAuthority(supabase, user.id, form.profile_id as string);
  if (!auth.authorised) {
    return { success: false, error: auth.error ?? "Not authorised" };
  }

  // Validate reason if provided
  if (data.reason_for_leaving && !VALID_LEAVING_REASONS.includes(data.reason_for_leaving as LeavingReason)) {
    return { success: false, error: "Invalid leaving reason" };
  }

  // Sanitise and update
  const sanitised = sanitiseLeavingFields(data);
  if (Object.keys(sanitised).length === 0) {
    return { success: false, error: "No valid fields to update" };
  }

  const { error: updateError } = await supabase
    .from("staff_leaving_forms")
    .update(sanitised)
    .eq("id", formId)
    .select("id")
    .single();

  if (updateError) {
    return { success: false, error: `Failed to update form: ${updateError.message}` };
  }

  revalidateLeavingPaths(form.profile_id as string);
  return { success: true, error: null };
}

// =============================================
// SUBMIT LEAVING FORM (Draft → Submitted)
// =============================================

export async function submitLeavingForm(
  formId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch form
  const { data: form } = await supabase
    .from("staff_leaving_forms")
    .select("id, profile_id, initiated_by, status, leaving_date, reason_for_leaving")
    .eq("id", formId)
    .single();

  if (!form) {
    return { success: false, error: "Leaving form not found" };
  }

  if ((form.status as string) !== "draft") {
    return { success: false, error: "This form has already been submitted" };
  }

  // Verify authority
  const auth = await verifyLeavingAuthority(supabase, user.id, form.profile_id as string);
  if (!auth.authorised) {
    return { success: false, error: auth.error ?? "Not authorised" };
  }

  // Validate required fields
  if (!form.leaving_date || !form.reason_for_leaving) {
    return { success: false, error: "Leaving date and reason are required before submitting" };
  }

  // Update status with race condition guard
  const { error: updateError } = await supabase
    .from("staff_leaving_forms")
    .update({ status: "submitted" })
    .eq("id", formId)
    .eq("status", "draft")
    .select("id")
    .single();

  if (updateError) {
    return { success: false, error: "Could not submit form. It may have already been submitted." };
  }

  // Fetch employee name for notification
  const { data: employee } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", form.profile_id as string)
    .single();

  const employeeName = (employee?.full_name as string) ?? "Unknown";
  const leavingDate = formatHRDate(form.leaving_date as string);

  // Notify all HR admins
  const { data: hrAdmins } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_hr_admin", true)
    .eq("status", "active");

  const notifRows = (hrAdmins ?? [])
    .filter((admin) => (admin.id as string) !== user.id)
    .map((admin) => ({
      user_id: admin.id as string,
      type: "staff_leaving_submitted",
      title: "Leaving Form Submitted",
      message: `A leaving form has been submitted for ${employeeName}. Leaving date: ${leavingDate}.`,
      link: `/hr/leaving/${formId}`,
      metadata: { form_id: formId, profile_id: form.profile_id },
    }));

  let notifFailed = false;
  if (notifRows.length > 0) {
    const { error: notifError } = await supabase.from("notifications").insert(notifRows);
    if (notifError) {
      notifFailed = true;
    }
  }

  if (notifFailed) {
    // Rollback: revert form status to draft
    const { error: rollbackError } = await supabase
      .from("staff_leaving_forms")
      .update({ status: "draft" })
      .eq("id", formId);

    if (rollbackError) {
      console.error(
        `CRITICAL: Failed to roll back leaving form ${formId} after notification failure.`,
        rollbackError,
      );
    }
    return { success: false, error: "Form submitted but could not notify HR. Please try again." };
  }

  revalidateLeavingPaths(form.profile_id as string);
  return { success: true, error: null };
}

// =============================================
// START PROCESSING (Submitted → In Progress)
// =============================================

export async function startProcessingForm(
  formId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase } = await requireHRAdmin();

  const { data: form } = await supabase
    .from("staff_leaving_forms")
    .select("id, profile_id, status")
    .eq("id", formId)
    .single();

  if (!form) {
    return { success: false, error: "Leaving form not found" };
  }

  if ((form.status as string) !== "submitted") {
    return { success: false, error: "This form must be in 'submitted' status to start processing" };
  }

  const { error: updateError } = await supabase
    .from("staff_leaving_forms")
    .update({ status: "in_progress" })
    .eq("id", formId)
    .eq("status", "submitted")
    .select("id")
    .single();

  if (updateError) {
    return { success: false, error: "Could not start processing. The form may have changed status." };
  }

  revalidateLeavingPaths(form.profile_id as string);
  return { success: true, error: null };
}

// =============================================
// COMPLETE LEAVING FORM (In Progress → Completed)
// =============================================

export async function completeLeavingForm(
  formId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await requireHRAdmin();

  // Fetch form
  const { data: form } = await supabase
    .from("staff_leaving_forms")
    .select(STAFF_LEAVING_FORM_SELECT)
    .eq("id", formId)
    .single();

  if (!form) {
    return { success: false, error: "Leaving form not found" };
  }

  if ((form.status as string) !== "in_progress") {
    return { success: false, error: "This form must be 'in progress' to complete" };
  }

  const profileId = form.profile_id as string;
  const leavingDate = form.leaving_date as string;
  const reason = form.reason_for_leaving as string;

  // Step 1: Update form status to completed
  const { error: formError } = await supabase
    .from("staff_leaving_forms")
    .update({
      status: "completed",
      completed_by: user.id,
      completed_at: new Date().toISOString(),
    })
    .eq("id", formId)
    .eq("status", "in_progress")
    .select("id")
    .single();

  if (formError) {
    return { success: false, error: "Could not complete form. It may have changed status." };
  }

  // Step 2: Insert employment history event (capture ID for precise rollback)
  const { data: historyRow, error: historyError } = await supabase
    .from("employment_history")
    .insert({
      profile_id: profileId,
      event_type: "left",
      effective_date: leavingDate,
      previous_value: "Active",
      new_value: `Left — ${reason}`,
      notes: (form.additional_notes as string) || null,
      recorded_by: user.id,
    })
    .select("id")
    .single();

  if (historyError) {
    // Rollback step 1
    const { error: rollbackError } = await supabase
      .from("staff_leaving_forms")
      .update({ status: "in_progress", completed_by: null, completed_at: null })
      .eq("id", formId);

    if (rollbackError) {
      console.error(
        `CRITICAL: Failed to roll back leaving form ${formId} after employment history insert failure.`,
        rollbackError,
      );
    }
    return { success: false, error: "Failed to record employment history. Please try again." };
  }

  // Step 3: Set profile to inactive
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ status: "inactive" })
    .eq("id", profileId)
    .select("id")
    .single();

  if (profileError) {
    // Rollback steps 1 and 2
    // Delete the employment history entry we just created (using captured ID)
    if (historyRow?.id) {
      await supabase
        .from("employment_history")
        .delete()
        .eq("id", historyRow.id as string);
    }

    const { error: rollbackError } = await supabase
      .from("staff_leaving_forms")
      .update({ status: "in_progress", completed_by: null, completed_at: null })
      .eq("id", formId);

    if (rollbackError) {
      console.error(
        `CRITICAL: Failed to roll back leaving form ${formId} after profile update failure.`,
        rollbackError,
      );
    }
    return { success: false, error: "Failed to update profile status. Please try again." };
  }

  // Step 4: Notify the initiator (non-blocking — don't rollback for notification failures)
  const initiatedBy = form.initiated_by as string | null;
  if (initiatedBy && initiatedBy !== user.id) {
    const { data: employee } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", profileId)
      .single();

    const employeeName = (employee?.full_name as string) ?? "Unknown";

    await supabase.from("notifications").insert({
      user_id: initiatedBy,
      type: "staff_leaving_completed",
      title: "Offboarding Completed",
      message: `The offboarding process for ${employeeName} has been completed.`,
      link: `/hr/leaving/${formId}`,
      metadata: { form_id: formId, profile_id: profileId },
    });
  }

  revalidateLeavingPaths(profileId);
  return { success: true, error: null };
}

// =============================================
// CANCEL LEAVING FORM
// =============================================

export async function cancelLeavingForm(
  formId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase } = await requireHRAdmin();

  const { data: form } = await supabase
    .from("staff_leaving_forms")
    .select("id, profile_id, status")
    .eq("id", formId)
    .single();

  if (!form) {
    return { success: false, error: "Leaving form not found" };
  }

  if ((form.status as string) === "completed") {
    return { success: false, error: "Cannot cancel a completed leaving form" };
  }

  if ((form.status as string) === "cancelled") {
    return { success: false, error: "This form is already cancelled" };
  }

  const { error: updateError } = await supabase
    .from("staff_leaving_forms")
    .update({ status: "cancelled" })
    .eq("id", formId)
    .select("id")
    .single();

  if (updateError) {
    return { success: false, error: `Failed to cancel form: ${updateError.message}` };
  }

  revalidateLeavingPaths(form.profile_id as string);
  return { success: true, error: null };
}

// =============================================
// FETCH LEAVING FORM SUMMARY (auto-calculated data)
// =============================================

export async function fetchLeavingFormSummary(profileId: string, leavingDate?: string): Promise<{
  outstandingAssets: Array<{
    id: string;
    asset_tag: string;
    asset_type_name: string;
    make: string | null;
    model: string | null;
  }>;
  activeComplianceDocs: Array<{
    id: string;
    document_type_name: string;
    expiry_date: string | null;
    status: string;
  }>;
  leaveBalance: {
    entitlement: number;
    used: number;
    remaining: number;
  } | null;
}> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { outstandingAssets: [], activeComplianceDocs: [], leaveBalance: null };
  }

  // Verify caller is authorised to view this employee's data
  const auth = await verifyLeavingAuthority(supabase, user.id, profileId);
  if (!auth.authorised) {
    return { outstandingAssets: [], activeComplianceDocs: [], leaveBalance: null };
  }

  const [
    { data: rawAssets },
    { data: rawDocs },
  ] = await Promise.all([
    supabase
      .from("asset_assignments")
      .select("id, assets(asset_tag, make, model, asset_types(name))")
      .eq("profile_id", profileId)
      .is("returned_date", null),
    supabase
      .from("compliance_documents")
      .select("id, status, expiry_date, compliance_document_types(name)")
      .eq("profile_id", profileId)
      .in("status", ["valid", "expiring_soon"]),
  ]);

  const outstandingAssets = (rawAssets ?? []).map((a) => {
    const asset = a.assets as unknown as {
      asset_tag: string;
      make: string | null;
      model: string | null;
      asset_types: { name: string } | null;
    } | null;
    return {
      id: a.id as string,
      asset_tag: asset?.asset_tag ?? "—",
      asset_type_name: asset?.asset_types?.name ?? "Unknown",
      make: asset?.make ?? null,
      model: asset?.model ?? null,
    };
  });

  const activeComplianceDocs = (rawDocs ?? []).map((d) => {
    const docType = d.compliance_document_types as unknown as { name: string } | null;
    return {
      id: d.id as string,
      document_type_name: docType?.name ?? "Unknown",
      expiry_date: d.expiry_date as string | null,
      status: d.status as string,
    };
  });

  const leaveBalance = await calculateFinalLeaveBalance(supabase, profileId, leavingDate);

  return {
    outstandingAssets,
    activeComplianceDocs,
    leaveBalance: leaveBalance !== null
      ? { entitlement: 0, used: 0, remaining: leaveBalance }
      : null,
  };
}

// =============================================
// LEAVE BALANCE CALCULATION (private helper)
// =============================================

/**
 * Calculate final annual leave balance for an employee.
 * Uses the same logic as the employee detail page.
 */
async function calculateFinalLeaveBalance(
  supabase: Awaited<ReturnType<typeof getCurrentUser>>["supabase"],
  profileId: string,
  leavingDate?: string,
): Promise<number | null> {
  const leaveYear = getLeaveYearForDate(leavingDate ? new Date(leavingDate) : undefined);

  const [{ data: entitlements }, { data: requests }] = await Promise.all([
    supabase
      .from("leave_entitlements")
      .select("leave_type, base_entitlement_days, fte_at_calculation, adjustments_days")
      .eq("profile_id", profileId)
      .eq("leave_year_start", leaveYear.start)
      .eq("leave_year_end", leaveYear.end),
    supabase
      .from("leave_requests")
      .select("leave_type, total_days, status")
      .eq("profile_id", profileId)
      .eq("status", "approved"),
  ]);

  if (!entitlements || entitlements.length === 0) {
    return null;
  }

  // Calculate total annual leave balance — accumulate across entitlement records
  // (an employee may have multiple rows, e.g. base + mid-year adjustment)
  let totalEntitlement = 0;
  for (const ent of entitlements) {
    if ((ent.leave_type as string) !== "annual") continue;

    totalEntitlement += Math.round(
      ((ent.base_entitlement_days as number) * (ent.fte_at_calculation as number) +
        (ent.adjustments_days as number)) * 2,
    ) / 2;
  }

  const totalUsed = (requests ?? [])
    .filter((r) => (r.leave_type as string) === "annual")
    .reduce((sum, r) => sum + (r.total_days as number), 0);

  return Math.round((totalEntitlement - totalUsed) * 2) / 2;
}
