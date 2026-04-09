import { getCurrentUser, isHRAdminEffective } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { FlexibleWorkingDashboard } from "@/components/hr/flexible-working-dashboard";
import { fetchFlexibleWorkingRequests, checkFWREligibility } from "./actions";
import type { FlexibleWorkingRequestWithEmployee } from "@/types/hr";

export default async function FlexibleWorkingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, profile } = await getCurrentUser();
  if (!user || !profile) {
    redirect("/login");
  }

  const { tab: activeTab = "my-requests" } = await searchParams;

  const [{ data: rawRequests }, eligibility] = await Promise.all([
    fetchFlexibleWorkingRequests(),
    checkFWREligibility(),
  ]);

  const isHRAdmin = isHRAdminEffective(profile);
  const isManager = profile.is_line_manager === true;

  // Map raw data to typed objects
  const requests: FlexibleWorkingRequestWithEmployee[] = (rawRequests ?? []).map((r) => {
    const emp = r.employee as unknown as {
      full_name: string;
      avatar_url: string | null;
      job_title: string | null;
      department: string | null;
    } | null;
    const mgr = r.manager as unknown as { full_name: string } | null;

    return {
      id: r.id as string,
      profile_id: r.profile_id as string,
      manager_id: r.manager_id as string | null,
      request_type: r.request_type as string,
      current_working_pattern: r.current_working_pattern as string,
      requested_working_pattern: r.requested_working_pattern as string,
      proposed_start_date: r.proposed_start_date as string,
      reason: r.reason as string | null,
      status: r.status as string,
      response_deadline: r.response_deadline as string,
      decided_by: r.decided_by as string | null,
      decided_at: r.decided_at as string | null,
      decision_notes: r.decision_notes as string | null,
      rejection_grounds: r.rejection_grounds as string[] | null,
      rejection_explanation: r.rejection_explanation as string | null,
      trial_end_date: r.trial_end_date as string | null,
      trial_outcome: r.trial_outcome as string | null,
      trial_outcome_at: r.trial_outcome_at as string | null,
      trial_outcome_by: r.trial_outcome_by as string | null,
      previous_work_pattern: r.previous_work_pattern as string | null,
      consultation_date: r.consultation_date as string | null,
      consultation_format: r.consultation_format as string | null,
      consultation_attendees: r.consultation_attendees as string | null,
      consultation_summary: r.consultation_summary as string | null,
      consultation_alternatives: r.consultation_alternatives as string | null,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      employee_name: emp?.full_name ?? "Unknown",
      employee_avatar: emp?.avatar_url ?? null,
      employee_job_title: emp?.job_title ?? null,
      employee_department: emp?.department ?? null,
      manager_name: mgr?.full_name ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flexible Working"
        subtitle="Manage flexible working requests under the Employment Rights Act 1996."
        breadcrumbs={isHRAdmin ? [
          { label: "Admin", href: "/hr" },
          { label: "Flexible Working" },
        ] : undefined}
      />

      <FlexibleWorkingDashboard
        requests={requests}
        currentUserId={user.id}
        isHRAdmin={isHRAdmin}
        isManager={isManager}
        activeTab={activeTab}
        eligible={eligibility.eligible}
        requestsInLast12Months={eligibility.requestsInLast12Months}
        hasLiveRequest={eligibility.hasLiveRequest}
      />
    </div>
  );
}
