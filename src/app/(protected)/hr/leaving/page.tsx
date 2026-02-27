import { requireHRAdmin } from "@/lib/auth";
import { STAFF_LEAVING_FORM_WITH_EMPLOYEE_SELECT } from "@/lib/hr";
import type { LeavingFormStatus, LeavingReason } from "@/lib/hr";
import { LeavingDashboardContent } from "@/components/hr/leaving-dashboard-content";
import { PageHeader } from "@/components/layout/page-header";
import { redirect } from "next/navigation";

/** Explicit SELECT for active employees (for the create dialog). */
const ACTIVE_EMPLOYEES_SELECT = "id, full_name, job_title";

export default async function LeavingDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  let result;
  try {
    result = await requireHRAdmin();
  } catch (error: unknown) {
    const err = error as Error;
    if (err?.message === "NEXT_REDIRECT" || (err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    redirect("/hr");
  }

  const supabase = result.supabase;
  const { tab: activeTab = "active" } = await searchParams;

  // Fetch all leaving forms with employee details
  const [{ data: rawForms }, { data: rawEmployees }] = await Promise.all([
    supabase
      .from("staff_leaving_forms")
      .select(`${STAFF_LEAVING_FORM_WITH_EMPLOYEE_SELECT}, initiator:profiles!staff_leaving_forms_initiated_by_fkey(full_name)`)
      .order("leaving_date", { ascending: true }),
    supabase
      .from("profiles")
      .select(ACTIVE_EMPLOYEES_SELECT)
      .eq("status", "active")
      .order("full_name"),
  ]);

  // Flatten leaving forms
  const leavingForms = (rawForms ?? []).map((f) => {
    const employee = f.profiles as unknown as {
      full_name: string;
      avatar_url: string | null;
      job_title: string | null;
      department: string | null;
    } | null;
    const initiator = f.initiator as unknown as { full_name: string } | null;

    return {
      id: f.id as string,
      profile_id: f.profile_id as string,
      initiated_by: f.initiated_by as string | null,
      completed_by: f.completed_by as string | null,
      completed_at: f.completed_at as string | null,
      status: f.status as LeavingFormStatus,
      leaving_date: f.leaving_date as string,
      last_working_date: f.last_working_date as string | null,
      reason_for_leaving: f.reason_for_leaving as LeavingReason,
      reason_details: f.reason_details as string | null,
      notice_period_start: f.notice_period_start as string | null,
      notice_period_end: f.notice_period_end as string | null,
      exit_interview_completed: f.exit_interview_completed as boolean,
      exit_interview_notes: f.exit_interview_notes as string | null,
      knowledge_transfer_completed: f.knowledge_transfer_completed as boolean,
      knowledge_transfer_notes: f.knowledge_transfer_notes as string | null,
      equipment_returned: f.equipment_returned as boolean,
      equipment_notes: f.equipment_notes as string | null,
      access_revoked: f.access_revoked as boolean,
      access_revoked_date: f.access_revoked_date as string | null,
      final_leave_balance: f.final_leave_balance as number | null,
      rehire_eligible: f.rehire_eligible as boolean | null,
      additional_notes: f.additional_notes as string | null,
      created_at: f.created_at as string,
      updated_at: f.updated_at as string,
      employee_name: employee?.full_name ?? "Unknown",
      employee_avatar: employee?.avatar_url ?? null,
      employee_job_title: employee?.job_title ?? null,
      employee_department: employee?.department ?? null,
      initiator_name: initiator?.full_name ?? null,
    };
  });

  // Flatten active employees for the create dialog
  const activeEmployees = (rawEmployees ?? []).map((e) => ({
    id: e.id as string,
    full_name: e.full_name as string,
    job_title: e.job_title as string | null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Leaving"
        subtitle="Manage offboarding for departing staff members."
      />

      <LeavingDashboardContent
        leavingForms={leavingForms}
        activeEmployees={activeEmployees}
        activeTab={activeTab}
      />
    </div>
  );
}
