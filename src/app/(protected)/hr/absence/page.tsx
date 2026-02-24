import { requireHRAdmin } from "@/lib/auth";
import { ABSENCE_RECORD_SELECT } from "@/lib/hr";
import { redirect } from "next/navigation";
import { AbsenceDashboardContent } from "@/components/hr/absence-dashboard-content";

export default async function AbsenceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const activeTab = sp.tab || "all";

  let supabase;
  try {
    const result = await requireHRAdmin();
    supabase = result.supabase;
  } catch {
    redirect("/hr");
  }

  // Fetch all absence records with employee names, plus RTW status
  const [
    { data: rawAbsences },
    { data: rawPendingRTW },
  ] = await Promise.all([
    supabase
      .from("absence_records")
      .select(`${ABSENCE_RECORD_SELECT}, profiles!absence_records_profile_id_fkey(full_name)`)
      .order("start_date", { ascending: false })
      .limit(200),
    supabase
      .from("return_to_work_forms")
      .select("id, absence_record_id, employee_id, absence_start_date, absence_end_date, status, completed_at, completed_by, profiles!return_to_work_forms_employee_id_fkey(full_name)")
      .in("status", ["submitted", "draft"])
      .order("completed_at", { ascending: false }),
  ]);

  // Fetch RTW forms for all absence records to map status
  const absenceIds = (rawAbsences ?? []).map((a) => a.id as string);
  const { data: rtwForAbsences } = absenceIds.length > 0
    ? await supabase
        .from("return_to_work_forms")
        .select("id, absence_record_id, status")
        .in("absence_record_id", absenceIds)
    : { data: [] };

  // Build RTW map: absence_record_id → { id, status }
  const rtwMap: Record<string, { id: string; status: string }> = {};
  for (const rtw of rtwForAbsences ?? []) {
    rtwMap[rtw.absence_record_id as string] = {
      id: rtw.id as string,
      status: rtw.status as string,
    };
  }

  // Flatten absence records
  const absenceRecords = (rawAbsences ?? []).map((r) => {
    const profile = r.profiles as unknown as { full_name: string } | null;
    const rtw = rtwMap[r.id as string];
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

  // Flatten pending RTW forms — also fetch completed_by name
  const completedByIds = [...new Set(
    (rawPendingRTW ?? [])
      .map((f) => f.completed_by as string | null)
      .filter(Boolean),
  )] as string[];

  const completedByMap: Record<string, string> = {};
  if (completedByIds.length > 0) {
    const { data: completedByProfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", completedByIds);
    for (const p of completedByProfiles ?? []) {
      completedByMap[p.id as string] = p.full_name as string;
    }
  }

  const pendingRTWForms = (rawPendingRTW ?? []).map((f) => {
    const profile = f.profiles as unknown as { full_name: string } | null;
    return {
      id: f.id as string,
      absence_record_id: f.absence_record_id as string,
      employee_id: f.employee_id as string,
      employee_name: profile?.full_name ?? "Unknown",
      absence_start_date: f.absence_start_date as string,
      absence_end_date: f.absence_end_date as string,
      status: f.status as "draft" | "submitted" | "confirmed" | "locked",
      completed_at: f.completed_at as string,
      completed_by_name: completedByMap[f.completed_by as string] ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Absence & Sickness</h1>
        <p className="text-muted-foreground mt-1">
          Track absence records and return-to-work forms
        </p>
      </div>

      <AbsenceDashboardContent
        absenceRecords={absenceRecords}
        pendingRTWForms={pendingRTWForms}
        activeTab={activeTab}
      />
    </div>
  );
}
