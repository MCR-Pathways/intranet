import { getCurrentUser } from "@/lib/auth";
import { STAFF_LEAVING_FORM_SELECT, calculateLengthOfService } from "@/lib/hr";
import type { LeavingFormStatus, LeavingReason } from "@/lib/hr";
import { notFound, redirect } from "next/navigation";
import { LeavingFormContent } from "@/components/hr/leaving-form-content";
import { fetchLeavingFormSummary } from "@/app/(protected)/hr/leaving/actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function LeavingFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  let result;
  try {
    result = await getCurrentUser();
  } catch (error: unknown) {
    const err = error as Error;
    if (err?.message === "NEXT_REDIRECT" || (err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    redirect("/hr");
  }

  const { supabase, user, profile } = result;
  if (!user) redirect("/login");

  const { formId } = await params;

  // Fetch the form with employee profile joined
  const { data: rawForm } = await supabase
    .from("staff_leaving_forms")
    .select(`${STAFF_LEAVING_FORM_SELECT}, profiles!staff_leaving_forms_profile_id_fkey(full_name, avatar_url, job_title, department, start_date, fte)`)
    .eq("id", formId)
    .single();

  if (!rawForm) {
    notFound();
  }

  // Verify authority: must be HR admin or the employee's line manager
  const isHRAdmin = profile?.is_hr_admin === true;
  const profileId = rawForm.profile_id as string;

  if (!isHRAdmin) {
    // Check if current user is the line manager
    const { data: employeeProfile } = await supabase
      .from("profiles")
      .select("line_manager_id")
      .eq("id", profileId)
      .single();

    if (employeeProfile?.line_manager_id !== user.id) {
      redirect("/hr");
    }
  }

  // Flatten form data
  const employee = rawForm.profiles as unknown as {
    full_name: string;
    avatar_url: string | null;
    job_title: string | null;
    department: string | null;
    start_date: string | null;
    fte: number | null;
  } | null;

  const form = {
    id: rawForm.id as string,
    profile_id: profileId,
    initiated_by: rawForm.initiated_by as string | null,
    completed_by: rawForm.completed_by as string | null,
    completed_at: rawForm.completed_at as string | null,
    status: rawForm.status as LeavingFormStatus,
    leaving_date: rawForm.leaving_date as string,
    last_working_date: rawForm.last_working_date as string | null,
    reason_for_leaving: rawForm.reason_for_leaving as LeavingReason,
    reason_details: rawForm.reason_details as string | null,
    notice_period_start: rawForm.notice_period_start as string | null,
    notice_period_end: rawForm.notice_period_end as string | null,
    exit_interview_completed: rawForm.exit_interview_completed as boolean,
    exit_interview_notes: rawForm.exit_interview_notes as string | null,
    knowledge_transfer_completed: rawForm.knowledge_transfer_completed as boolean,
    knowledge_transfer_notes: rawForm.knowledge_transfer_notes as string | null,
    equipment_returned: rawForm.equipment_returned as boolean,
    equipment_notes: rawForm.equipment_notes as string | null,
    access_revoked: rawForm.access_revoked as boolean,
    access_revoked_date: rawForm.access_revoked_date as string | null,
    final_leave_balance: rawForm.final_leave_balance as number | null,
    rehire_eligible: rawForm.rehire_eligible as boolean | null,
    additional_notes: rawForm.additional_notes as string | null,
    created_at: rawForm.created_at as string,
    updated_at: rawForm.updated_at as string,
  };

  // Fetch auto-calculated summary data
  const summary = await fetchLeavingFormSummary(profileId);

  const lengthOfService = employee?.start_date
    ? calculateLengthOfService(employee.start_date, form.leaving_date)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/hr/leaving">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Leaving Form</h1>
          <p className="text-muted-foreground">
            {employee?.full_name ?? "Unknown"}{employee?.job_title ? ` — ${employee.job_title}` : ""}
          </p>
        </div>
      </div>

      <LeavingFormContent
        form={form}
        employeeName={employee?.full_name ?? "Unknown"}
        employeeJobTitle={employee?.job_title ?? null}
        employeeDepartment={employee?.department ?? null}
        lengthOfService={lengthOfService}
        outstandingAssets={summary.outstandingAssets}
        activeComplianceDocs={summary.activeComplianceDocs}
        leaveBalance={summary.leaveBalance}
        isHRAdmin={isHRAdmin}
      />
    </div>
  );
}
