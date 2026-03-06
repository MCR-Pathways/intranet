import { requireHRAdmin } from "@/lib/auth";
import { HR_EMPLOYEE_SELECT } from "@/lib/auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { EmployeeDetailContent } from "@/components/hr/employee-detail-content";
import { PageHeader } from "@/components/layout/page-header";
import { getHolidayCalendar, getLeaveYearForDate, ABSENCE_RECORD_SELECT, RTW_FORM_SELECT, STAFF_LEAVING_FORM_SELECT } from "@/lib/hr";
import type { ComplianceStatus, ContractType, WorkPattern, LeaveType, Region, SicknessCategory } from "@/lib/hr";
import type { AbsenceType, ReturnToWorkForm, RTWStatus, StaffLeavingForm } from "@/types/hr";
import type { LeavingFormStatus, LeavingReason } from "@/lib/hr";
import { fetchEmployeeOnboarding, fetchActiveTemplates } from "@/app/(protected)/hr/onboarding/actions";

/** Select columns for employee_details. */
const EMPLOYEE_DETAILS_SELECT =
  "id, profile_id, date_of_birth, gender, pronouns, nationality, address_line_1, address_line_2, city, postcode, country, personal_email, personal_phone, ni_number";

/** Select columns for emergency_contacts. */
const EMERGENCY_CONTACTS_SELECT =
  "id, profile_id, full_name, relationship, phone_primary, phone_secondary, email, sort_order";

/** Select columns for employment_history. */
const EMPLOYMENT_HISTORY_SELECT =
  "id, profile_id, event_type, effective_date, previous_value, new_value, notes, recorded_by, created_at";

/** Select columns for compliance_documents with joined type name. */
const COMPLIANCE_DOCS_SELECT =
  "id, profile_id, document_type_id, reference_number, issue_date, expiry_date, status, file_name, file_path, notes, verified_at, verified_by, compliance_document_types(name)";

/** Select columns for leave_entitlements. */
const LEAVE_ENTITLEMENTS_SELECT =
  "id, profile_id, leave_year_start, leave_year_end, leave_type, base_entitlement_days, fte_at_calculation, adjustments_days, notes";

/** Select columns for leave_requests. */
const LEAVE_REQUESTS_SELECT =
  "id, profile_id, leave_type, start_date, end_date, start_half_day, end_half_day, total_days, reason, status, decided_by, decided_at, decision_notes, rejection_reason, created_at";

/** Select columns for asset_assignments joined with assets. */
const ASSET_ASSIGNMENTS_SELECT =
  "id, asset_id, assigned_date, returned_date, condition_on_assignment, condition_on_return, assets(asset_tag, make, model, asset_types(name))";

/** Select columns for key_dates. */
const KEY_DATES_SELECT =
  "id, profile_id, date_type, due_date, title, description, is_completed";

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ userId }, searchParamsResolved] = await Promise.all([
    params,
    searchParams,
  ]);
  const activeTab = searchParamsResolved.tab || "overview";

  let supabase;
  let currentUserId: string;
  try {
    const result = await requireHRAdmin();
    supabase = result.supabase;
    currentUserId = result.user.id;
  } catch {
    redirect("/hr");
  }

  // Fetch the target employee profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(HR_EMPLOYEE_SELECT)
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    notFound();
  }

  // Determine the current leave year (calendar year)
  const leaveYear = getLeaveYearForDate();
  const leaveYearStart = leaveYear.start;

  // Fetch associated data in parallel
  const [
    { data: employeeDetails },
    { data: emergencyContacts },
    { data: employmentHistory },
    { data: rawDocs },
    { data: documentTypes },
    { data: leaveEntitlements },
    { data: leaveRequests },
    { data: rawAssignments },
    { data: keyDates },
    { data: publicHolidayRows },
    { data: absenceRecords },
    { data: rtwForms },
    { data: rawLeavingForm },
    { data: departmentRows },
    { data: activeProfiles },
    { data: allTeams },
  ] = await Promise.all([
    supabase
      .from("employee_details")
      .select(EMPLOYEE_DETAILS_SELECT)
      .eq("profile_id", userId)
      .single(),
    supabase
      .from("emergency_contacts")
      .select(EMERGENCY_CONTACTS_SELECT)
      .eq("profile_id", userId)
      .order("sort_order"),
    supabase
      .from("employment_history")
      .select(EMPLOYMENT_HISTORY_SELECT)
      .eq("profile_id", userId)
      .order("effective_date", { ascending: false }),
    supabase
      .from("compliance_documents")
      .select(COMPLIANCE_DOCS_SELECT)
      .eq("profile_id", userId)
      .order("expiry_date"),
    supabase
      .from("compliance_document_types")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("leave_entitlements")
      .select(LEAVE_ENTITLEMENTS_SELECT)
      .eq("profile_id", userId)
      .eq("leave_year_start", leaveYearStart),
    supabase
      .from("leave_requests")
      .select(LEAVE_REQUESTS_SELECT)
      .eq("profile_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("asset_assignments")
      .select(ASSET_ASSIGNMENTS_SELECT)
      .eq("profile_id", userId)
      .order("assigned_date", { ascending: false }),
    supabase
      .from("key_dates")
      .select(KEY_DATES_SELECT)
      .eq("profile_id", userId)
      .order("due_date"),
    supabase
      .from("public_holidays")
      .select("holiday_date")
      .in("region", [getHolidayCalendar(profile.region as Region | null), "all"])
      .eq("year", leaveYear.year),
    supabase
      .from("absence_records")
      .select(ABSENCE_RECORD_SELECT)
      .eq("profile_id", userId)
      .order("start_date", { ascending: false }),
    supabase
      .from("return_to_work_forms")
      .select(RTW_FORM_SELECT)
      .eq("employee_id", userId),
    supabase
      .from("staff_leaving_forms")
      .select(STAFF_LEAVING_FORM_SELECT)
      .eq("profile_id", userId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("departments")
      .select("slug, name")
      .eq("is_active", true)
      .order("sort_order"),
    // Active profiles for line manager combobox
    supabase
      .from("profiles")
      .select("id, full_name, job_title")
      .eq("status", "active")
      .order("full_name"),
    // Teams for team combobox
    supabase
      .from("teams")
      .select("id, name")
      .order("name"),
  ]);

  // Resolve line manager name
  let lineManagerName: string | null = null;
  if (profile.line_manager_id) {
    const { data: manager } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", profile.line_manager_id)
      .single();
    lineManagerName = manager?.full_name ?? null;
  }

  // Resolve team name
  let teamName: string | null = null;
  if (profile.team_id) {
    const { data: team } = await supabase
      .from("teams")
      .select("name")
      .eq("id", profile.team_id)
      .single();
    teamName = team?.name ?? null;
  }

  // Flatten compliance documents
  const complianceDocuments = (rawDocs ?? []).map((doc) => {
    const docType = doc.compliance_document_types as unknown as { name: string } | null;
    return {
      id: doc.id as string,
      document_type_name: docType?.name ?? "Unknown",
      status: doc.status as ComplianceStatus,
      issue_date: doc.issue_date as string | null,
      expiry_date: doc.expiry_date as string | null,
      reference_number: doc.reference_number as string | null,
      file_name: doc.file_name as string | null,
      file_path: doc.file_path as string | null,
      notes: doc.notes as string | null,
      verified_at: doc.verified_at as string | null,
    };
  });

  // Flatten document types for the upload dialog
  const complianceDocumentTypes = (documentTypes ?? []).map((dt) => ({
    id: dt.id as string,
    name: dt.name as string,
  }));

  // Calculate leave balances
  const leaveBalances = (leaveEntitlements ?? []).map((ent) => {
    const type = ent.leave_type as LeaveType;
    const entitlement = Math.round(
      ((ent.base_entitlement_days as number) * (ent.fte_at_calculation as number) +
        (ent.adjustments_days as number)) * 2,
    ) / 2;
    const typeRequests = (leaveRequests ?? []).filter(
      (r) => r.leave_type === type,
    );
    const used = typeRequests
      .filter((r) => r.status === "approved")
      .reduce((sum, r) => sum + (r.total_days as number), 0);
    const pending = typeRequests
      .filter((r) => r.status === "pending")
      .reduce((sum, r) => sum + (r.total_days as number), 0);
    return {
      leave_type: type,
      entitlement,
      used,
      pending,
      remaining: entitlement - used,
      available: entitlement - used - pending,
    };
  });

  // Flatten leave requests
  const flatLeaveRequests = (leaveRequests ?? []).map((r) => ({
    id: r.id as string,
    profile_id: r.profile_id as string,
    leave_type: r.leave_type as LeaveType,
    start_date: r.start_date as string,
    end_date: r.end_date as string,
    start_half_day: r.start_half_day as boolean,
    end_half_day: r.end_half_day as boolean,
    total_days: r.total_days as number,
    reason: r.reason as string | null,
    status: r.status as "pending" | "approved" | "rejected" | "cancelled" | "withdrawn",
    decided_by: r.decided_by as string | null,
    decided_at: r.decided_at as string | null,
    decision_notes: r.decision_notes as string | null,
    rejection_reason: r.rejection_reason as string | null,
    created_at: r.created_at as string,
  }));

  // Flatten asset assignments
  const assetAssignments = (rawAssignments ?? []).map((a) => {
    const asset = a.assets as unknown as {
      asset_tag: string;
      make: string | null;
      model: string | null;
      asset_types: { name: string } | null;
    } | null;
    return {
      id: a.id as string,
      asset_id: a.asset_id as string,
      asset_tag: asset?.asset_tag ?? "—",
      asset_type_name: asset?.asset_types?.name ?? "Unknown",
      make: asset?.make ?? null,
      model: asset?.model ?? null,
      assigned_date: a.assigned_date as string,
      returned_date: a.returned_date as string | null,
      condition_on_assignment: a.condition_on_assignment as string | null,
      condition_on_return: a.condition_on_return as string | null,
    };
  });

  // Flatten key dates
  const flatKeyDates = (keyDates ?? []).map((kd) => ({
    id: kd.id as string,
    profile_id: kd.profile_id as string,
    date_type: kd.date_type as string,
    due_date: kd.due_date as string,
    title: kd.title as string,
    description: kd.description as string | null,
    is_completed: kd.is_completed as boolean,
  }));

  // Public holidays as string array
  const publicHolidays = (publicHolidayRows ?? []).map((h) => h.holiday_date as string);

  // Build RTW form map keyed by absence_record_id
  const rtwFormMap: Record<string, ReturnToWorkForm> = {};
  for (const form of rtwForms ?? []) {
    rtwFormMap[form.absence_record_id as string] = form as unknown as ReturnToWorkForm;
  }

  // Flatten absence records with RTW status
  const flatAbsenceRecords = (absenceRecords ?? []).map((r) => {
    const rtwForm = rtwFormMap[r.id as string];
    return {
      id: r.id as string,
      profile_id: r.profile_id as string,
      leave_request_id: r.leave_request_id as string | null,
      absence_type: r.absence_type as AbsenceType,
      start_date: r.start_date as string,
      end_date: r.end_date as string,
      total_days: r.total_days as number,
      is_long_term: r.is_long_term as boolean,
      reason: r.reason as string | null,
      sickness_category: (r.sickness_category as SicknessCategory) ?? null,
      fit_note_path: r.fit_note_path as string | null,
      fit_note_file_name: r.fit_note_file_name as string | null,
      recorded_by: r.recorded_by as string | null,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      rtw_status: (rtwForm?.status as RTWStatus) ?? null,
      rtw_form_id: rtwForm?.id ?? null,
    };
  });

  // Cast profile to the EmployeeProfile shape
  const employeeProfile = {
    id: profile.id as string,
    full_name: profile.full_name as string,
    preferred_name: profile.preferred_name as string | null,
    email: profile.email as string,
    avatar_url: profile.avatar_url as string | null,
    job_title: profile.job_title as string | null,
    user_type: profile.user_type as "staff" | "pathways_coordinator" | "new_user",
    status: profile.status as "active" | "inactive" | "pending_induction",
    fte: (profile.fte as number) ?? 1,
    department: profile.department ?? null,
    region: profile.region ?? null,
    is_line_manager: profile.is_line_manager as boolean,
    is_hr_admin: profile.is_hr_admin as boolean,
    is_ld_admin: profile.is_ld_admin as boolean,
    is_systems_admin: (profile.is_systems_admin as boolean) ?? false,
    is_external: (profile.is_external as boolean) ?? false,
    phone: profile.phone as string | null,
    start_date: profile.start_date as string | null,
    contract_type: ((profile.contract_type as string) ?? "permanent") as ContractType,
    contract_end_date: profile.contract_end_date as string | null,
    probation_end_date: profile.probation_end_date as string | null,
    work_pattern: ((profile.work_pattern as string) ?? "standard") as WorkPattern,
    line_manager_id: profile.line_manager_id as string | null,
    team_id: profile.team_id as string | null,
    induction_completed_at: profile.induction_completed_at as string | null,
    created_at: profile.created_at as string,
  };

  // Flatten leaving form
  const leavingForm: StaffLeavingForm | null = rawLeavingForm
    ? {
        id: rawLeavingForm.id as string,
        profile_id: rawLeavingForm.profile_id as string,
        initiated_by: rawLeavingForm.initiated_by as string | null,
        completed_by: rawLeavingForm.completed_by as string | null,
        completed_at: rawLeavingForm.completed_at as string | null,
        status: rawLeavingForm.status as LeavingFormStatus,
        leaving_date: rawLeavingForm.leaving_date as string,
        last_working_date: rawLeavingForm.last_working_date as string | null,
        reason_for_leaving: rawLeavingForm.reason_for_leaving as LeavingReason,
        reason_details: rawLeavingForm.reason_details as string | null,
        notice_period_start: rawLeavingForm.notice_period_start as string | null,
        notice_period_end: rawLeavingForm.notice_period_end as string | null,
        exit_interview_completed: rawLeavingForm.exit_interview_completed as boolean,
        exit_interview_notes: rawLeavingForm.exit_interview_notes as string | null,
        knowledge_transfer_completed: rawLeavingForm.knowledge_transfer_completed as boolean,
        knowledge_transfer_notes: rawLeavingForm.knowledge_transfer_notes as string | null,
        equipment_returned: rawLeavingForm.equipment_returned as boolean,
        equipment_notes: rawLeavingForm.equipment_notes as string | null,
        access_revoked: rawLeavingForm.access_revoked as boolean,
        access_revoked_date: rawLeavingForm.access_revoked_date as string | null,
        final_leave_balance: rawLeavingForm.final_leave_balance as number | null,
        rehire_eligible: rawLeavingForm.rehire_eligible as boolean | null,
        additional_notes: rawLeavingForm.additional_notes as string | null,
        created_at: rawLeavingForm.created_at as string,
        updated_at: rawLeavingForm.updated_at as string,
      }
    : null;

  // Build combobox options for line manager / team pickers
  const people = (activeProfiles ?? []).map((p) => ({
    id: p.id as string,
    full_name: p.full_name as string,
    job_title: p.job_title as string | null,
  }));
  const teamOptions = (allTeams ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
  }));

  // Fetch onboarding data
  const [onboardingData, onboardingTemplates] = await Promise.all([
    fetchEmployeeOnboarding(userId),
    fetchActiveTemplates(),
  ]);

  // Check if current user is the employee's line manager
  const isCurrentUserManager = (profile.line_manager_id as string | null) === currentUserId;

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.full_name ?? "User Details"}
        subtitle={profile.job_title || "No job title set"}
        breadcrumbs={[
          { label: "HR", href: "/hr" },
          { label: "User Management", href: "/hr/users" },
          { label: profile.full_name ?? "User" },
        ]}
      />

      <EmployeeDetailContent
        profile={employeeProfile}
        employeeDetails={employeeDetails ?? null}
        emergencyContacts={emergencyContacts ?? []}
        employmentHistory={employmentHistory ?? []}
        complianceDocuments={complianceDocuments}
        complianceDocumentTypes={complianceDocumentTypes}
        isHRAdmin
        currentUserId={currentUserId}
        lineManagerName={lineManagerName}
        teamName={teamName}
        activeTab={activeTab}
        leaveBalances={leaveBalances}
        leaveRequests={flatLeaveRequests}
        publicHolidays={publicHolidays}
        assetAssignments={assetAssignments}
        keyDates={flatKeyDates}
        absenceRecords={flatAbsenceRecords}
        rtwForms={rtwFormMap}
        leavingForm={leavingForm}
        onboardingActive={onboardingData.active}
        onboardingHistory={onboardingData.history}
        onboardingTemplates={onboardingTemplates}
        departments={(departmentRows ?? []).map((d) => ({ slug: d.slug as string, name: d.name as string }))}
        isManager={isCurrentUserManager}
        people={people}
        teams={teamOptions}
      />
    </div>
  );
}
