import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OrgChartContent } from "@/components/hr/org-chart-content";

/** Select columns for org chart nodes. */
const ORG_CHART_SELECT =
  "id, full_name, job_title, avatar_url, department, region, line_manager_id, status, is_line_manager, is_external, fte";

export default async function OrgChartPage() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const today = new Date().toISOString().split("T")[0];

  const [{ data: profiles }, { data: onLeaveRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select(ORG_CHART_SELECT)
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("leave_requests")
      .select("profile_id")
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today),
  ]);

  const people = (profiles ?? []).map((p) => ({
    id: p.id as string,
    full_name: p.full_name as string,
    job_title: p.job_title as string | null,
    avatar_url: p.avatar_url as string | null,
    department: p.department as string | null,
    region: p.region as string | null,
    line_manager_id: p.line_manager_id as string | null,
    is_line_manager: (p.is_line_manager as boolean) ?? false,
    is_external: (p.is_external as boolean) ?? false,
    fte: (p.fte as number) ?? 1,
  }));

  const onLeaveIds = new Set(
    (onLeaveRows ?? []).map((r) => r.profile_id as string)
  );

  return (
    <OrgChartContent
      people={people}
      onLeaveIds={Array.from(onLeaveIds)}
      currentUserId={user.id}
    />
  );
}
