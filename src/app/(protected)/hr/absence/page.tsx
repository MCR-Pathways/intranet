import { getCurrentUser, isHRAdminEffective } from "@/lib/auth";
import { ABSENCE_RECORD_SELECT } from "@/lib/hr";
import { redirect } from "next/navigation";
import { AbsenceDashboardContent } from "@/components/hr/absence-dashboard-content";
import { PageHeader } from "@/components/layout/page-header";

export default async function AbsenceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const activeTab = sp.tab || "all";

  const { supabase, profile } = await getCurrentUser();
  if (!isHRAdminEffective(profile)) {
    redirect("/hr");
  }

  // Fetch all absence records with employee names and RTW status (via joins)
  const [
    { data: rawAbsences },
    { data: rawPendingRTW },
  ] = await Promise.all([
    supabase
      .from("absence_records")
      .select(`${ABSENCE_RECORD_SELECT}, profiles!absence_records_profile_id_fkey(full_name), return_to_work_forms(id, status)`)
      .order("start_date", { ascending: false })
      .limit(200),
    supabase
      .from("return_to_work_forms")
      .select("id, absence_record_id, employee_id, absence_start_date, absence_end_date, status, completed_at, completed_by, profiles!return_to_work_forms_employee_id_fkey(full_name), completed_by_profile:profiles!return_to_work_forms_completed_by_fkey(full_name)")
      .in("status", ["submitted", "draft"])
      .order("completed_at", { ascending: false }),
  ]);

  // Flatten absence records (RTW status now comes from the join)
  const absenceRecords = (rawAbsences ?? []).map((r) => {
    const profile = r.profiles as unknown as { full_name: string } | null;
    const rtwForms = r.return_to_work_forms as unknown as Array<{ id: string; status: string }> | null;
    const rtw = rtwForms?.[0] ?? null;
    return {
      id: r.id as string,
      profile_id: r.profile_id as string,
      absence_type: r.absence_type as string,
      start_date: r.start_date as string,
      end_date: r.end_date as string,
      total_days: r.total_days as number,
      is_long_term: r.is_long_term as boolean,
      sickness_category: r.sickness_category as string | null,
      reason: r.reason as string | null,
      employee_name: profile?.full_name ?? "Unknown",
      rtw_status: (rtw?.status as "draft" | "submitted" | "confirmed" | "locked") ?? null,
      rtw_form_id: rtw?.id ?? null,
    };
  });

  // Flatten pending RTW forms (completed_by name now comes from the join)
  const pendingRTWForms = (rawPendingRTW ?? []).map((f) => {
    const profile = f.profiles as unknown as { full_name: string } | null;
    const completedByProfile = f.completed_by_profile as unknown as { full_name: string } | null;
    return {
      id: f.id as string,
      absence_record_id: f.absence_record_id as string,
      employee_id: f.employee_id as string,
      employee_name: profile?.full_name ?? "Unknown",
      absence_start_date: f.absence_start_date as string,
      absence_end_date: f.absence_end_date as string,
      status: f.status as "draft" | "submitted" | "confirmed" | "locked",
      completed_at: f.completed_at as string,
      completed_by_name: completedByProfile?.full_name ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Absence & Sickness"
        subtitle="Track absence records and return-to-work forms"
        breadcrumbs={[
          { label: "Admin", href: "/hr" },
          { label: "Absence & Sickness" },
        ]}
      />

      <AbsenceDashboardContent
        absenceRecords={absenceRecords}
        pendingRTWForms={pendingRTWForms}
        activeTab={activeTab}
      />
    </div>
  );
}
