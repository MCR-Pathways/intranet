"use server";

import { getCurrentUser, requireHRAdmin } from "@/lib/auth";
import {
  FLEXIBLE_WORKING_REQUEST_SELECT,
  FLEXIBLE_WORKING_REQUEST_WITH_PEOPLE_SELECT,
  FWR_APPEAL_SELECT,
  formatHRDate,
} from "@/lib/hr";
import type {
  FWRRequestType,
  FWRRejectionGround,
  FWRConsultationFormat,
  FWRTrialOutcome,
} from "@/lib/hr";
import type { Database } from "@/types/database.types";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { validateTextLength, MAX_LONG_TEXT_LENGTH } from "@/lib/validation";

// =============================================
// ROW TYPES (subset projections for queries)
// =============================================

/** Full row shape returned by FLEXIBLE_WORKING_REQUEST_SELECT. */
type FWRRow = Database["public"]["Tables"]["flexible_working_requests"]["Row"];

/** FWR row joined with employee + manager profiles (FLEXIBLE_WORKING_REQUEST_WITH_PEOPLE_SELECT). */
type FWRWithPeopleRow = FWRRow & {
  employee: { full_name: string; avatar_url: string | null; job_title: string | null; department: string | null } | null;
  manager: { full_name: string } | null;
};

/** Minimal FWR columns used for status/ownership checks. */
type FWRStatusRow = Pick<FWRRow, "id" | "profile_id" | "status">;

/** FWR columns used for authority checks (includes manager_id). */
type FWRAuthRow = Pick<FWRRow, "id" | "profile_id" | "status" | "manager_id">;

/** FWR columns used for rejection checks (includes consultation_date). */
type FWRRejectionCheckRow = Pick<FWRRow, "id" | "profile_id" | "status" | "manager_id" | "consultation_date">;

/** Row returned by an insert/update that selects only the id. */
type IdRow = { id: string };

/** Full appeal row shape returned by FWR_APPEAL_SELECT. */
type FWRAppealRow = Database["public"]["Tables"]["fwr_appeals"]["Row"];

/** Supabase query result shape used for type assertions on tables missing from database.types.ts. */
type QueryResult<T> = { data: T; error: null } | { data: null; error: { message: string; code?: string } };

// =============================================
// CONSTANTS
// =============================================

/** Maximum statutory requests per 12-month period (Employment Relations Act 2023). */
const MAX_REQUESTS_PER_YEAR = 2;

/** Valid request types (must match DB CHECK constraint). */
const VALID_REQUEST_TYPES: FWRRequestType[] = [
  "flexible_hours", "compressed_hours", "reduced_hours", "job_sharing",
  "remote_hybrid", "annualised_hours", "staggered_hours", "term_time", "other",
];

/** Valid rejection grounds (must match FWR_REJECTION_GROUNDS keys). */
const VALID_REJECTION_GROUNDS: FWRRejectionGround[] = [
  "additional_costs", "customer_demand", "cannot_reorganise", "cannot_recruit",
  "quality_impact", "performance_impact", "insufficient_work", "structural_changes",
];

/** Valid consultation formats. */
const VALID_CONSULTATION_FORMATS: FWRConsultationFormat[] = [
  "in_person", "video", "phone",
];

/** Valid trial outcomes. */
const VALID_TRIAL_OUTCOMES: FWRTrialOutcome[] = [
  "confirmed", "extended", "reverted",
];

/** Fields the manager can update via the generic update action. */
const CONSULTATION_ALLOWED_FIELDS = [
  "consultation_date",
  "consultation_format",
  "consultation_attendees",
  "consultation_summary",
  "consultation_alternatives",
] as const;

// =============================================
// REVALIDATION HELPER
// =============================================

function revalidateFWRPaths(profileId?: string) {
  revalidatePath("/hr/flexible-working");
  revalidatePath("/hr");
  if (profileId) {
    revalidatePath(`/hr/users/${profileId}`);
  }
}

// =============================================
// AUTHORITY CHECK
// =============================================

/**
 * Verify the current user can manage a flexible working request.
 * Must be the assigned manager or an HR admin.
 */
async function verifyFWRAuthority(
  supabase: Awaited<ReturnType<typeof getCurrentUser>>["supabase"],
  currentUserId: string,
  requestProfileId: string,
  _requestManagerId: string | null,
): Promise<{ authorised: boolean; isHRAdmin: boolean; error?: string }> {
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("id, is_hr_admin")
    .eq("id", currentUserId)
    .single();

  if (currentProfile?.is_hr_admin === true) {
    return { authorised: true, isHRAdmin: true };
  }

  // Verify manager relationship against profiles table, not just the request's manager_id.
  // This prevents privilege escalation if manager_id was tampered with.
  const { data: employeeProfile } = await supabase
    .from("profiles")
    .select("line_manager_id")
    .eq("id", requestProfileId)
    .single();

  if (employeeProfile?.line_manager_id === currentUserId) {
    return { authorised: true, isHRAdmin: false };
  }

  return {
    authorised: false,
    isHRAdmin: false,
    error: "You are not authorised to manage this flexible working request",
  };
}

// =============================================
// SANITISE CONSULTATION FIELDS
// =============================================

const CONSULTATION_FORMAT_VALUES = ["in_person", "video", "phone"] as const;

function sanitiseConsultationFields(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const sanitised: Record<string, unknown> = {};
  for (const field of CONSULTATION_ALLOWED_FIELDS) {
    if (!(field in data)) continue;
    const value = data[field];

    if (field === "consultation_date") {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) continue;
    } else if (field === "consultation_format") {
      if (typeof value !== "string" || !CONSULTATION_FORMAT_VALUES.includes(value as typeof CONSULTATION_FORMAT_VALUES[number])) continue;
    } else {
      // Text fields: must be string
      if (typeof value !== "string") continue;
    }

    sanitised[field] = value;
  }
  return sanitised;
}

// =============================================
// FETCH REQUESTS (list)
// =============================================

/**
 * Fetch flexible working requests visible to the current user.
 * - Regular employees: own requests only
 * - Line managers: own + direct reports' requests
 * - HR admins: all requests
 */
export async function fetchFlexibleWorkingRequests(): Promise<{
  data: Record<string, unknown>[];
  error: string | null;
}> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { data: [], error: "Not authenticated" };
  }

  // RLS handles filtering — just fetch all visible to the current user
  const { data, error } = await supabase
    .from("flexible_working_requests")
    .select(FLEXIBLE_WORKING_REQUEST_WITH_PEOPLE_SELECT)
    .order("created_at", { ascending: false }) as unknown as QueryResult<FWRWithPeopleRow[]>;

  if (error) {
    logger.error("Failed to fetch flexible working requests", { error });
    return { data: [], error: "Failed to fetch flexible working requests. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  return { data: data ?? [], error: null };
}

// =============================================
// FETCH SINGLE REQUEST (detail)
// =============================================

export async function fetchFlexibleWorkingRequest(requestId: string): Promise<{
  data: Record<string, unknown> | null;
  appeal: Record<string, unknown> | null;
  error: string | null;
}> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { data: null, appeal: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("flexible_working_requests")
    .select(FLEXIBLE_WORKING_REQUEST_WITH_PEOPLE_SELECT)
    .eq("id", requestId)
    .single() as unknown as QueryResult<FWRWithPeopleRow>;

  if (error) {
    return { data: null, appeal: null, error: "Request not found" };
  }

  // Fetch appeal if status is appealed/appeal_upheld/appeal_overturned
  let appeal: Record<string, unknown> | null = null;
  const status = data.status;
  if (["appealed", "appeal_upheld", "appeal_overturned"].includes(status)) {
    const { data: appealData } = await supabase
      .from("fwr_appeals")
      .select(FWR_APPEAL_SELECT)
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single() as unknown as QueryResult<FWRAppealRow>;

    appeal = appealData as Record<string, unknown> | null;
  }

  return { data, appeal, error: null };
}

// =============================================
// CHECK ELIGIBILITY
// =============================================

/**
 * Check whether the current user can submit a new flexible working request.
 * Returns the count of requests made in the last 12 months and whether
 * they have a live (unresolved) request.
 */
export async function checkFWREligibility(): Promise<{
  eligible: boolean;
  requestsInLast12Months: number;
  hasLiveRequest: boolean;
  error: string | null;
}> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { eligible: false, requestsInLast12Months: 0, hasLiveRequest: false, error: "Not authenticated" };
  }

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const [{ data: recentRequests }, { data: liveRequests }] = await Promise.all([
    supabase
      .from("flexible_working_requests")
      .select("id")
      .eq("profile_id", user.id)
      .neq("status", "withdrawn")
      .gte("created_at", twelveMonthsAgo.toISOString()) as unknown as QueryResult<IdRow[]>,
    supabase
      .from("flexible_working_requests")
      .select("id")
      .eq("profile_id", user.id)
      .in("status", ["submitted", "under_review", "appealed"]) as unknown as QueryResult<IdRow[]>,
  ]);

  const count = recentRequests?.length ?? 0;
  const hasLive = (liveRequests?.length ?? 0) > 0;

  return {
    eligible: count < MAX_REQUESTS_PER_YEAR && !hasLive,
    requestsInLast12Months: count,
    hasLiveRequest: hasLive,
    error: null,
  };
}

// =============================================
// CREATE REQUEST
// =============================================

export async function createFlexibleWorkingRequest(data: {
  request_type: string;
  current_working_pattern: string;
  requested_working_pattern: string;
  proposed_start_date: string;
  reason?: string;
}): Promise<{ success: boolean; error: string | null; requestId?: string }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Validate inputs
  if (!data.request_type || !data.current_working_pattern?.trim() || !data.requested_working_pattern?.trim() || !data.proposed_start_date) {
    return { success: false, error: "Request type, current pattern, requested pattern, and start date are required" };
  }

  if (!VALID_REQUEST_TYPES.includes(data.request_type as FWRRequestType)) {
    return { success: false, error: "Invalid request type" };
  }

  // Validate text lengths (FWR fields are legally significant — LONG limit)
  for (const value of [data.current_working_pattern, data.requested_working_pattern, data.reason]) {
    if (value) {
      const err = validateTextLength(value, MAX_LONG_TEXT_LENGTH);
      if (err) return { success: false, error: err };
    }
  }

  // Fetch the employee's profile for manager_id and current work_pattern
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, line_manager_id, work_pattern, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, error: "Profile not found" };
  }

  // Calculate response deadline (2 months from now)
  const deadline = new Date();
  deadline.setMonth(deadline.getMonth() + 2);

  // Insert the request (DB trigger enforces 2-request limit)
  const { data: request, error: insertError } = await supabase
    .from("flexible_working_requests")
    .insert({
      profile_id: user.id,
      manager_id: profile.line_manager_id as string | null,
      request_type: data.request_type as FWRRequestType,
      current_working_pattern: data.current_working_pattern.trim(),
      requested_working_pattern: data.requested_working_pattern.trim(),
      proposed_start_date: data.proposed_start_date,
      reason: data.reason?.trim() || null,
      status: "submitted" as const,
      response_deadline: deadline.toISOString().split("T")[0],
      previous_work_pattern: profile.work_pattern ?? "standard",
    })
    .select("id")
    .single() as unknown as QueryResult<IdRow>;

  if (insertError) {
    // Check for unique constraint (live request exists) or trigger exception (2 requests limit)
    if (insertError.code === "23505") {
      return {
        success: false,
        error: "You already have an active flexible working request. You can withdraw the existing request from its detail page, or contact HR if you believe this is incorrect.",
      };
    }
    if (insertError.message?.includes("2 flexible working requests")) {
      return {
        success: false,
        error: "You have already made 2 flexible working requests in the last 12 months (statutory limit).",
      };
    }
    logger.error("Failed to create flexible working request", { error: insertError.message });
    return { success: false, error: "Failed to create request. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  const requestId = request.id as string;
  const employeeName = (profile.full_name as string) ?? "Unknown";
  const managerId = profile.line_manager_id as string | null;

  // Notify manager + HR admins (non-blocking)
  const notifTargets: string[] = [];

  if (managerId) {
    notifTargets.push(managerId);
  }

  const { data: hrAdmins } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_hr_admin", true)
    .eq("status", "active");

  for (const admin of hrAdmins ?? []) {
    const adminId = admin.id as string;
    if (adminId !== user.id && !notifTargets.includes(adminId)) {
      notifTargets.push(adminId);
    }
  }

  if (notifTargets.length > 0) {
    const notifRows = notifTargets.map((targetId) => ({
      user_id: targetId,
      type: "fwr_submitted",
      title: "Flexible Working Request",
      message: `${employeeName} has submitted a flexible working request.`,
      link: `/hr/flexible-working/${requestId}`,
      metadata: { request_id: requestId, profile_id: user.id },
    }));

    await supabase.from("notifications").insert(notifRows);
  }

  revalidateFWRPaths(user.id);
  return { success: true, error: null, requestId };
}

// =============================================
// WITHDRAW REQUEST
// =============================================

export async function withdrawFlexibleWorkingRequest(
  requestId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: request } = await supabase
    .from("flexible_working_requests")
    .select("id, profile_id, status")
    .eq("id", requestId)
    .single() as unknown as QueryResult<FWRStatusRow>;

  if (!request) {
    return { success: false, error: "Request not found" };
  }

  if (request.profile_id !== user.id) {
    return { success: false, error: "You can only withdraw your own requests" };
  }

  if (!["submitted", "under_review"].includes(request.status)) {
    return { success: false, error: "This request can no longer be withdrawn" };
  }

  const { error: updateError } = await supabase
    .from("flexible_working_requests")
    .update({ status: "withdrawn" })
    .eq("id", requestId)
    .in("status", ["submitted", "under_review"])
    .select("id")
    .single() as unknown as QueryResult<IdRow>;

  if (updateError) {
    return { success: false, error: "Could not withdraw request. It may have already been actioned." };
  }

  revalidateFWRPaths(user.id);
  return { success: true, error: null };
}

// =============================================
// MARK AS UNDER REVIEW
// =============================================

/**
 * Manager acknowledges the request — moves from submitted to under_review.
 * This starts the formal review process.
 */
export async function markRequestUnderReview(
  requestId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: request } = await supabase
    .from("flexible_working_requests")
    .select("id, profile_id, manager_id, status")
    .eq("id", requestId)
    .single() as unknown as QueryResult<FWRAuthRow>;

  if (!request) {
    return { success: false, error: "Request not found" };
  }

  if (request.status !== "submitted") {
    return { success: false, error: "This request is no longer in 'submitted' status" };
  }

  const auth = await verifyFWRAuthority(supabase, user.id, request.profile_id, request.manager_id);
  if (!auth.authorised) {
    return { success: false, error: auth.error ?? "Not authorised" };
  }

  const { error: updateError } = await supabase
    .from("flexible_working_requests")
    .update({ status: "under_review" })
    .eq("id", requestId)
    .eq("status", "submitted")
    .select("id")
    .single() as unknown as QueryResult<IdRow>;

  if (updateError) {
    return { success: false, error: "Could not update request status." };
  }

  revalidateFWRPaths(request.profile_id);
  return { success: true, error: null };
}

// =============================================
// RECORD CONSULTATION
// =============================================

/**
 * Manager records the consultation meeting details.
 * Required before a rejection can be issued (Acas Code of Practice).
 */
export async function recordConsultation(
  requestId: string,
  data: Record<string, unknown>,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: request } = await supabase
    .from("flexible_working_requests")
    .select("id, profile_id, manager_id, status")
    .eq("id", requestId)
    .single() as unknown as QueryResult<FWRAuthRow>;

  if (!request) {
    return { success: false, error: "Request not found" };
  }

  if (!["submitted", "under_review"].includes(request.status)) {
    return { success: false, error: "Consultation can only be recorded on active requests" };
  }

  const auth = await verifyFWRAuthority(supabase, user.id, request.profile_id, request.manager_id);
  if (!auth.authorised) {
    return { success: false, error: auth.error ?? "Not authorised" };
  }

  // Validate consultation format if provided
  if (data.consultation_format && !VALID_CONSULTATION_FORMATS.includes(data.consultation_format as FWRConsultationFormat)) {
    return { success: false, error: "Invalid consultation format" };
  }

  // Validate text lengths before sanitising
  const consultationTextFields = ["consultation_attendees", "consultation_summary", "consultation_alternatives"] as const;
  for (const field of consultationTextFields) {
    const val = data[field];
    if (val && typeof val === "string") {
      const err = validateTextLength(val, MAX_LONG_TEXT_LENGTH);
      if (err) return { success: false, error: err };
    }
  }

  const sanitised = sanitiseConsultationFields(data);
  if (Object.keys(sanitised).length === 0) {
    return { success: false, error: "No valid consultation fields provided" };
  }

  const { error: updateError } = await supabase
    .from("flexible_working_requests")
    .update(sanitised)
    .eq("id", requestId)
    .select("id")
    .single() as unknown as QueryResult<IdRow>;

  if (updateError) {
    logger.error("Failed to record consultation", { requestId, error: updateError.message });
    return { success: false, error: "Failed to record consultation. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidateFWRPaths(request.profile_id);
  return { success: true, error: null };
}

// =============================================
// APPROVE REQUEST
// =============================================

export async function approveFlexibleWorkingRequest(
  requestId: string,
  data: {
    decision_notes?: string;
    trial_period?: boolean;
    trial_end_date?: string;
  },
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: request } = await supabase
    .from("flexible_working_requests")
    .select(FLEXIBLE_WORKING_REQUEST_SELECT)
    .eq("id", requestId)
    .single() as unknown as QueryResult<FWRRow>;

  if (!request) {
    return { success: false, error: "Request not found" };
  }

  if (!["submitted", "under_review"].includes(request.status)) {
    return { success: false, error: "This request can no longer be approved" };
  }

  const auth = await verifyFWRAuthority(supabase, user.id, request.profile_id, request.manager_id);
  if (!auth.authorised) {
    return { success: false, error: auth.error ?? "Not authorised" };
  }

  if (data.decision_notes) {
    const notesErr = validateTextLength(data.decision_notes, MAX_LONG_TEXT_LENGTH);
    if (notesErr) return { success: false, error: notesErr };
  }

  const profileId = request.profile_id;
  const isTrial = data.trial_period === true && data.trial_end_date;
  const newStatus = isTrial ? "approved_trial" : "approved";

  // Step 1: Update request status
  const updatePayload: Database["public"]["Tables"]["flexible_working_requests"]["Update"] = {
    status: newStatus,
    decided_by: user.id,
    decided_at: new Date().toISOString(),
    decision_notes: data.decision_notes?.trim() || null,
    ...(isTrial ? { trial_end_date: data.trial_end_date } : {}),
  };

  const { error: updateError } = await supabase
    .from("flexible_working_requests")
    .update(updatePayload)
    .eq("id", requestId)
    .in("status", ["submitted", "under_review"])
    .select("id")
    .single() as unknown as QueryResult<IdRow>;

  if (updateError) {
    logger.error("Failed to approve flexible working request", { requestId, error: updateError.message });
    return { success: false, error: "Could not approve request. It may have already been actioned." };
  }

  // Step 2: If not a trial, update the employee's profile work_pattern
  if (!isTrial) {
    const newWorkPattern = mapRequestTypeToWorkPattern(request.request_type);

    if (newWorkPattern) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ work_pattern: newWorkPattern })
        .eq("id", profileId)
        .select("id")
        .single();

      if (profileError) {
        logger.error("Failed to update work pattern during FWR approval, rolling back", {
          requestId, profileId, error: profileError.message,
        });
        // Rollback step 1
        await supabase
          .from("flexible_working_requests")
          .update({ status: request.status, decided_by: null, decided_at: null, decision_notes: null })
          .eq("id", requestId);

        return { success: false, error: "Failed to update employee's work pattern. Please try again." };
      }

      // Step 3: Create employment history record
      await supabase.from("employment_history").insert({
        profile_id: profileId,
        event_type: "work_pattern_change",
        effective_date: request.proposed_start_date ?? new Date().toISOString().split("T")[0],
        previous_value: request.previous_work_pattern ?? "standard",
        new_value: newWorkPattern,
        notes: `Flexible working request approved: ${request.requested_working_pattern}`,
        recorded_by: user.id,
      });
    }
  }

  // Notify employee (non-blocking — failure should not break the approval)
  try {
    await supabase.from("notifications").insert({
      user_id: profileId,
      type: "fwr_approved",
      title: "Flexible Working Request Approved",
      message: isTrial
        ? `Your flexible working request has been approved for a trial period until ${formatHRDate(data.trial_end_date!)}.`
        : "Your flexible working request has been approved.",
      link: `/hr/flexible-working/${requestId}`,
      metadata: { request_id: requestId },
    });
  } catch (notifError) {
    logger.warn("Failed to send FWR approval notification", { requestId, profileId, error: notifError });
  }

  revalidateFWRPaths(profileId);
  return { success: true, error: null };
}

// =============================================
// REJECT REQUEST
// =============================================

export async function rejectFlexibleWorkingRequest(
  requestId: string,
  data: {
    rejection_grounds: string[];
    rejection_explanation: string;
    decision_notes?: string;
  },
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Validate rejection data
  if (!data.rejection_grounds || data.rejection_grounds.length === 0) {
    return { success: false, error: "At least one statutory ground for refusal is required" };
  }

  if (!data.rejection_explanation?.trim()) {
    return { success: false, error: "An explanation of why refusal is reasonable is required" };
  }

  const explErr = validateTextLength(data.rejection_explanation, MAX_LONG_TEXT_LENGTH);
  if (explErr) return { success: false, error: explErr };

  if (data.decision_notes) {
    const notesErr = validateTextLength(data.decision_notes, MAX_LONG_TEXT_LENGTH);
    if (notesErr) return { success: false, error: notesErr };
  }

  // Validate each ground
  for (const ground of data.rejection_grounds) {
    if (!VALID_REJECTION_GROUNDS.includes(ground as FWRRejectionGround)) {
      return { success: false, error: `Invalid rejection ground: ${ground}` };
    }
  }

  const { data: request } = await supabase
    .from("flexible_working_requests")
    .select("id, profile_id, manager_id, status, consultation_date")
    .eq("id", requestId)
    .single() as unknown as QueryResult<FWRRejectionCheckRow>;

  if (!request) {
    return { success: false, error: "Request not found" };
  }

  if (!["submitted", "under_review"].includes(request.status)) {
    return { success: false, error: "This request can no longer be rejected" };
  }

  // Acas Code of Practice: consultation must be recorded before rejection
  if (!request.consultation_date) {
    return {
      success: false,
      error: "You must record a consultation meeting with the employee before rejecting their request (Acas Code of Practice).",
    };
  }

  const auth = await verifyFWRAuthority(supabase, user.id, request.profile_id, request.manager_id);
  if (!auth.authorised) {
    return { success: false, error: auth.error ?? "Not authorised" };
  }

  const { error: updateError } = await supabase
    .from("flexible_working_requests")
    .update({
      status: "rejected",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decision_notes: data.decision_notes?.trim() || null,
      rejection_grounds: data.rejection_grounds,
      rejection_explanation: data.rejection_explanation.trim(),
    })
    .eq("id", requestId)
    .in("status", ["submitted", "under_review"])
    .select("id")
    .single() as unknown as QueryResult<IdRow>;

  if (updateError) {
    logger.error("Failed to reject flexible working request", { requestId, error: updateError.message });
    return { success: false, error: "Could not reject request. It may have already been actioned." };
  }

  const profileId = request.profile_id;

  // Notify employee (non-blocking — failure should not break the rejection)
  try {
    await supabase.from("notifications").insert({
      user_id: profileId,
      type: "fwr_rejected",
      title: "Flexible Working Request Rejected",
      message: "Your flexible working request has been rejected. You have the right to appeal this decision.",
      link: `/hr/flexible-working/${requestId}`,
      metadata: { request_id: requestId },
    });
  } catch (notifError) {
    logger.warn("Failed to send FWR rejection notification", { requestId, profileId, error: notifError });
  }

  revalidateFWRPaths(profileId);
  return { success: true, error: null };
}

// =============================================
// RECORD TRIAL OUTCOME
// =============================================

export async function recordTrialOutcome(
  requestId: string,
  data: {
    outcome: string;
    notes?: string;
    extended_end_date?: string;
  },
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  if (!VALID_TRIAL_OUTCOMES.includes(data.outcome as FWRTrialOutcome)) {
    return { success: false, error: "Invalid trial outcome" };
  }

  const { data: request } = await supabase
    .from("flexible_working_requests")
    .select(FLEXIBLE_WORKING_REQUEST_SELECT)
    .eq("id", requestId)
    .single() as unknown as QueryResult<FWRRow>;

  if (!request) {
    return { success: false, error: "Request not found" };
  }

  if (request.status !== "approved_trial") {
    return { success: false, error: "This request is not in a trial period" };
  }

  const auth = await verifyFWRAuthority(supabase, user.id, request.profile_id, request.manager_id);
  if (!auth.authorised) {
    return { success: false, error: auth.error ?? "Not authorised" };
  }

  const profileId = request.profile_id;

  const updatePayload: Record<string, unknown> = {
    trial_outcome: data.outcome,
    trial_outcome_at: new Date().toISOString(),
    trial_outcome_by: user.id,
  };

  if (data.outcome === "confirmed") {
    updatePayload.status = "approved";
  } else if (data.outcome === "extended") {
    if (!data.extended_end_date) {
      return { success: false, error: "Extended end date is required when extending a trial" };
    }
    updatePayload.trial_end_date = data.extended_end_date;
  } else if (data.outcome === "reverted") {
    updatePayload.status = "approved";
  }

  // Step 1: Update the request first (safest to roll back from)
  const { error: updateError } = await supabase
    .from("flexible_working_requests")
    .update(updatePayload)
    .eq("id", requestId)
    .eq("status", "approved_trial")
    .select("id")

    .single();

  if (updateError) {
    logger.error("Failed to record trial outcome", { requestId, error: updateError.message });
    return { success: false, error: "Could not record trial outcome." };
  }

  // Step 2: If confirmed, update the employee's profile work_pattern
  if (data.outcome === "confirmed") {
    const newWorkPattern = mapRequestTypeToWorkPattern(request.request_type);

    if (newWorkPattern) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ work_pattern: newWorkPattern })
        .eq("id", profileId)
        .select("id")
        .single();

      if (profileError) {
        logger.error("Failed to update work pattern during trial confirmation, rolling back", {
          requestId, profileId, error: profileError.message,
        });
        // Rollback step 1
        await supabase
          .from("flexible_working_requests")
          .update({ status: "approved_trial", trial_outcome: null, trial_outcome_at: null, trial_outcome_by: null })
          .eq("id", requestId);

        return { success: false, error: "Failed to update employee's work pattern. Please try again." };
      }

      // Employment history
      await supabase.from("employment_history").insert({
        profile_id: profileId,
        event_type: "work_pattern_change",
        effective_date: new Date().toISOString().split("T")[0],
        previous_value: request.previous_work_pattern ?? "standard",
        new_value: newWorkPattern,
        notes: `Flexible working trial confirmed permanent: ${request.requested_working_pattern}`,
        recorded_by: user.id,
      });
    }
  }

  // Notify employee (non-blocking — failure should not break the trial outcome)
  try {
    const outcomeLabels: Record<string, string> = {
      confirmed: "Your flexible working arrangement has been confirmed as permanent.",
      extended: `Your flexible working trial period has been extended until ${formatHRDate(data.extended_end_date!)}.`,
      reverted: "Your flexible working trial has ended and your working pattern will revert to its previous arrangement.",
    };

    await supabase.from("notifications").insert({
      user_id: profileId,
      type: "fwr_approved",
      title: "Flexible Working Trial Outcome",
      message: outcomeLabels[data.outcome] ?? "Your trial outcome has been recorded.",
      link: `/hr/flexible-working/${requestId}`,
      metadata: { request_id: requestId },
    });
  } catch (notifError) {
    logger.warn("Failed to send trial outcome notification", { requestId, profileId, error: notifError });
  }

  revalidateFWRPaths(profileId);
  return { success: true, error: null };
}

// =============================================
// SUBMIT APPEAL
// =============================================

export async function submitFWRAppeal(
  requestId: string,
  appealReason: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  if (!appealReason?.trim()) {
    return { success: false, error: "Appeal reason is required" };
  }

  const { data: request } = await supabase
    .from("flexible_working_requests")
    .select("id, profile_id, status")
    .eq("id", requestId)

    .single();

  if (!request) {
    return { success: false, error: "Request not found" };
  }

  if (request.profile_id !== user.id) {
    return { success: false, error: "You can only appeal your own requests" };
  }

  if (request.status !== "rejected") {
    return { success: false, error: "Only rejected requests can be appealed" };
  }

  const appealErr = validateTextLength(appealReason, MAX_LONG_TEXT_LENGTH);
  if (appealErr) return { success: false, error: appealErr };

  // Step 1: Create appeal record
  const { error: appealError } = await supabase
    .from("fwr_appeals")
    .insert({
      request_id: requestId,
      appeal_reason: appealReason.trim(),
    })
    .select("id")

    .single();

  if (appealError) {
    logger.error("Failed to submit appeal", { error: appealError.message });
    return { success: false, error: "Failed to submit appeal. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  // Step 2: Update request status
  const { error: updateError } = await supabase
    .from("flexible_working_requests")
    .update({ status: "appealed" })
    .eq("id", requestId)
    .eq("status", "rejected")
    .select("id")

    .single();

  if (updateError) {
    return { success: false, error: "Could not update request status." };
  }

  // Notify HR admins (non-blocking — failure should not break the appeal)
  try {
    const { data: employee } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const employeeName = (employee?.full_name as string) ?? "Unknown";

    const { data: hrAdmins } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_hr_admin", true)
      .eq("status", "active");

    const notifRows = (hrAdmins ?? [])
      .filter((admin) => (admin.id as string) !== user.id)
      .map((admin) => ({
        user_id: admin.id as string,
        type: "fwr_appeal_submitted",
        title: "Flexible Working Appeal",
        message: `${employeeName} has appealed their rejected flexible working request.`,
        link: `/hr/flexible-working/${requestId}`,
        metadata: { request_id: requestId, profile_id: user.id },
      }));

    if (notifRows.length > 0) {
      await supabase.from("notifications").insert(notifRows);
    }
  } catch (notifError) {
    logger.warn("Failed to send FWR appeal notifications", { requestId, error: notifError });
  }

  revalidateFWRPaths(user.id);
  return { success: true, error: null };
}

// =============================================
// DECIDE APPEAL (HR admin only)
// =============================================

export async function decideFWRAppeal(
  requestId: string,
  data: {
    outcome: "upheld" | "overturned";
    outcome_notes?: string;
    meeting_date?: string;
    meeting_notes?: string;
  },
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await requireHRAdmin();

  if (!["upheld", "overturned"].includes(data.outcome)) {
    return { success: false, error: "Invalid appeal outcome" };
  }

  const { data: request } = await supabase
    .from("flexible_working_requests")
    .select(FLEXIBLE_WORKING_REQUEST_SELECT)
    .eq("id", requestId)

    .single();

  if (!request) {
    return { success: false, error: "Request not found" };
  }

  if (request.status !== "appealed") {
    return { success: false, error: "This request is not in 'appealed' status" };
  }

  const profileId = request.profile_id;

  // Fetch the appeal record
  const { data: appeal } = await supabase
    .from("fwr_appeals")
    .select("id")
    .eq("request_id", requestId)

    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!appeal) {
    return { success: false, error: "Appeal record not found" };
  }

  for (const value of [data.outcome_notes, data.meeting_notes]) {
    if (value) {
      const err = validateTextLength(value, MAX_LONG_TEXT_LENGTH);
      if (err) return { success: false, error: err };
    }
  }

  // Step 1: Update appeal record
  const { error: appealError } = await supabase
    .from("fwr_appeals")
    .update({
      outcome: data.outcome,
      outcome_notes: data.outcome_notes?.trim() || null,
      meeting_date: data.meeting_date || null,
      meeting_notes: data.meeting_notes?.trim() || null,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", appeal.id)
    .select("id")

    .single();

  if (appealError) {
    logger.error("Failed to record appeal decision", { requestId, error: appealError.message });
    return { success: false, error: "Failed to record appeal decision. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  // Step 2: Update request status
  const newStatus = data.outcome === "upheld" ? "appeal_upheld" : "appeal_overturned";

  const { error: updateError } = await supabase
    .from("flexible_working_requests")
    .update({ status: newStatus })
    .eq("id", requestId)
    .eq("status", "appealed")
    .select("id")

    .single();

  if (updateError) {
    logger.error("Failed to update request status during appeal decision", { requestId, error: updateError.message });
    return { success: false, error: "Could not update request status." };
  }

  // Step 3: If appeal overturned (i.e. approved), update profile + employment history
  if (data.outcome === "overturned") {
    const newWorkPattern = mapRequestTypeToWorkPattern(request.request_type);

    if (newWorkPattern) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ work_pattern: newWorkPattern })
        .eq("id", profileId)
        .select("id")
        .single();

      if (profileError) {
        logger.error("Failed to update work pattern during appeal overturn, rolling back", {
          requestId, profileId, error: profileError.message,
        });
        // Rollback steps 1 & 2
        await supabase
          .from("flexible_working_requests")
          .update({ status: "appealed" })
          .eq("id", requestId);
        await supabase
          .from("fwr_appeals")
          .update({ outcome: null, outcome_notes: null, decided_by: null, decided_at: null })
          .eq("id", appeal.id);

        return { success: false, error: "Failed to update employee's work pattern. Please try again." };
      }

      await supabase.from("employment_history").insert({
        profile_id: profileId,
        event_type: "work_pattern_change",
        effective_date: request.proposed_start_date ?? new Date().toISOString().split("T")[0],
        previous_value: request.previous_work_pattern ?? "standard",
        new_value: newWorkPattern,
        notes: `Flexible working request approved on appeal: ${request.requested_working_pattern}`,
        recorded_by: user.id,
      });
    }
  }

  // Notify employee (non-blocking — failure should not break the appeal decision)
  try {
    const outcomeMessage = data.outcome === "upheld"
      ? "Your flexible working appeal has been reviewed. The original decision has been upheld."
      : "Your flexible working appeal has been successful. Your request has been approved.";

    await supabase.from("notifications").insert({
      user_id: profileId,
      type: "fwr_appeal_decided",
      title: "Flexible Working Appeal Decision",
      message: outcomeMessage,
      link: `/hr/flexible-working/${requestId}`,
      metadata: { request_id: requestId },
    });
  } catch (notifError) {
    logger.warn("Failed to send appeal decision notification", { requestId, profileId, error: notifError });
  }

  revalidateFWRPaths(profileId);
  return { success: true, error: null };
}

// =============================================
// HELPER: Map request type to work_pattern value
// =============================================

/**
 * Map a flexible working request type to the corresponding profiles.work_pattern value.
 * Returns null if no direct mapping exists (e.g. for remote_hybrid or job_sharing,
 * which don't correspond to a work_pattern enum value).
 */
function mapRequestTypeToWorkPattern(requestType: string): string | null {
  const mapping: Record<string, string> = {
    compressed_hours: "compressed",
    reduced_hours: "part_time",
    term_time: "term_time",
  };

  return mapping[requestType] ?? null;
}
