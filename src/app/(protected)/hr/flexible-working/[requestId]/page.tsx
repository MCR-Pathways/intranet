import { getCurrentUser } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { FlexibleWorkingDetail } from "@/components/hr/flexible-working-detail";
import { fetchFlexibleWorkingRequest } from "../actions";
import type { FlexibleWorkingRequest, FWRAppeal } from "@/types/hr";

export default async function FlexibleWorkingDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { user, profile } = await getCurrentUser();
  if (!user || !profile) {
    redirect("/login");
  }

  const { requestId } = await params;
  const { data: rawRequest, appeal: rawAppeal, error } = await fetchFlexibleWorkingRequest(requestId);

  if (error || !rawRequest) {
    notFound();
  }

  // Map raw data
  const emp = rawRequest.employee as unknown as {
    full_name: string;
    avatar_url: string | null;
    job_title: string | null;
    department: string | null;
  } | null;
  const mgr = rawRequest.manager as unknown as { full_name: string } | null;

  const request: FlexibleWorkingRequest & {
    employee_name: string;
    employee_job_title: string | null;
    manager_name: string | null;
  } = {
    id: rawRequest.id as string,
    profile_id: rawRequest.profile_id as string,
    manager_id: rawRequest.manager_id as string | null,
    request_type: rawRequest.request_type as string,
    current_working_pattern: rawRequest.current_working_pattern as string,
    requested_working_pattern: rawRequest.requested_working_pattern as string,
    proposed_start_date: rawRequest.proposed_start_date as string,
    reason: rawRequest.reason as string | null,
    status: rawRequest.status as string,
    response_deadline: rawRequest.response_deadline as string,
    decided_by: rawRequest.decided_by as string | null,
    decided_at: rawRequest.decided_at as string | null,
    decision_notes: rawRequest.decision_notes as string | null,
    rejection_grounds: rawRequest.rejection_grounds as string[] | null,
    rejection_explanation: rawRequest.rejection_explanation as string | null,
    trial_end_date: rawRequest.trial_end_date as string | null,
    trial_outcome: rawRequest.trial_outcome as string | null,
    trial_outcome_at: rawRequest.trial_outcome_at as string | null,
    trial_outcome_by: rawRequest.trial_outcome_by as string | null,
    previous_work_pattern: rawRequest.previous_work_pattern as string | null,
    consultation_date: rawRequest.consultation_date as string | null,
    consultation_format: rawRequest.consultation_format as string | null,
    consultation_attendees: rawRequest.consultation_attendees as string | null,
    consultation_summary: rawRequest.consultation_summary as string | null,
    consultation_alternatives: rawRequest.consultation_alternatives as string | null,
    created_at: rawRequest.created_at as string,
    updated_at: rawRequest.updated_at as string,
    employee_name: emp?.full_name ?? "Unknown",
    employee_job_title: emp?.job_title ?? null,
    manager_name: mgr?.full_name ?? null,
  };

  const appeal: FWRAppeal | null = rawAppeal
    ? {
        id: rawAppeal.id as string,
        request_id: rawAppeal.request_id as string,
        appeal_reason: rawAppeal.appeal_reason as string,
        appealed_at: rawAppeal.appealed_at as string,
        meeting_date: rawAppeal.meeting_date as string | null,
        meeting_notes: rawAppeal.meeting_notes as string | null,
        outcome: rawAppeal.outcome as string | null,
        outcome_notes: rawAppeal.outcome_notes as string | null,
        decided_by: rawAppeal.decided_by as string | null,
        decided_at: rawAppeal.decided_at as string | null,
        created_at: rawAppeal.created_at as string,
        updated_at: rawAppeal.updated_at as string,
      }
    : null;

  const isHRAdmin = profile.is_hr_admin === true;
  const isOwner = request.profile_id === user.id;
  const isAssignedManager = request.manager_id === user.id;

  const breadcrumbs = [
    { label: "HR", href: "/hr" },
    { label: "Flexible Working", href: "/hr/flexible-working" },
    { label: request.employee_name },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flexible Working Request"
        breadcrumbs={breadcrumbs}
      />

      <FlexibleWorkingDetail
        request={request}
        appeal={appeal}
        currentUserId={user.id}
        isHRAdmin={isHRAdmin}
        isOwner={isOwner}
        isAssignedManager={isAssignedManager}
      />
    </div>
  );
}
