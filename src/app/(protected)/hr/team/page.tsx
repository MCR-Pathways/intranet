import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TeamDashboardContent } from "@/components/hr/team-dashboard-content";
import { TeamPeerContent } from "@/components/hr/team-peer-content";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

/** Columns selected for team member cards. */
const TEAM_MEMBER_SELECT =
  "id, full_name, preferred_name, avatar_url, job_title, start_date, work_pattern, status, is_external";

/** Check if a start_date has a work anniversary within the next N days. */
function getUpcomingAnniversary(
  startDate: string | null,
  today: Date,
  withinDays: number = 14,
): { years: number; date: string } | null {
  if (!startDate) return null;
  const start = new Date(startDate + "T00:00:00");
  const currentYear = today.getFullYear();

  // Anniversary this year
  const anniv = new Date(currentYear, start.getMonth(), start.getDate());

  // If already passed, check next year
  if (anniv < today) {
    anniv.setFullYear(currentYear + 1);
  }

  const diff = anniv.getTime() - today.getTime();
  const daysUntil = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (daysUntil > withinDays) return null;

  const years = anniv.getFullYear() - start.getFullYear();
  if (years < 1) return null; // Don't count the first year — that's not an anniversary

  return {
    years,
    date: anniv.toISOString().split("T")[0],
  };
}

export default async function TeamPage() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const today = new Date().toISOString().split("T")[0];
  const isManager = profile.is_line_manager === true;

  // Orphan — no line_manager_id set and not a manager
  if (!profile.line_manager_id && !isManager) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Team"
          subtitle="View your team members"
        />
        <EmptyState
          icon={Users}
          title="No team assigned"
          description="Contact HR if you believe this is an error."
        />
      </div>
    );
  }

  // ── Manager view ──────────────────────────────────────
  if (isManager) {
    const [{ data: reports }, { data: onLeaveRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select(TEAM_MEMBER_SELECT)
        .eq("line_manager_id", user.id)
        .eq("status", "active")
        .order("full_name"),
      supabase
        .from("leave_requests")
        .select("profile_id, leave_type, end_date")
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today),
    ]);

    const directReports = (reports ?? []).map((r) => ({
      id: r.id as string,
      full_name: r.full_name as string,
      preferred_name: r.preferred_name as string | null,
      avatar_url: r.avatar_url as string | null,
      job_title: r.job_title as string | null,
      start_date: r.start_date as string | null,
      work_pattern: r.work_pattern as string | null,
      is_external: (r.is_external as boolean) ?? false,
    }));

    // Build on-leave map: profileId → { leave_type, end_date }
    const onLeaveMap = new Map<string, { leave_type: string; end_date: string }>();
    const reportIds = new Set(directReports.map((r) => r.id));
    for (const row of onLeaveRows ?? []) {
      const pid = row.profile_id as string;
      if (reportIds.has(pid)) {
        onLeaveMap.set(pid, {
          leave_type: row.leave_type as string,
          end_date: row.end_date as string,
        });
      }
    }

    // Pending approvals count
    const { count: pendingCount } = await supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .in("profile_id", directReports.map((r) => r.id))
      .eq("status", "pending");

    // Compute upcoming work anniversaries (within 14 days)
    const todayDate = new Date();
    const anniversaries: Record<string, { years: number; date: string }> = {};
    for (const report of directReports) {
      const anniv = getUpcomingAnniversary(report.start_date, todayDate);
      if (anniv) anniversaries[report.id] = anniv;
    }

    return (
      <TeamDashboardContent
        reports={directReports}
        onLeaveMap={Object.fromEntries(onLeaveMap)}
        pendingApprovalCount={pendingCount ?? 0}
        anniversaries={anniversaries}
        currentUserId={user.id}
      />
    );
  }

  // ── Non-manager (peer) view ───────────────────────────
  const managerId = profile.line_manager_id as string;

  const [{ data: peers }, { data: managerData }, { data: onLeaveRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select(TEAM_MEMBER_SELECT)
      .eq("line_manager_id", managerId)
      .eq("status", "active")
      .neq("id", user.id)
      .order("full_name"),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, job_title")
      .eq("id", managerId)
      .single(),
    supabase
      .from("leave_requests")
      .select("profile_id, leave_type, end_date")
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today),
  ]);

  const peerList = (peers ?? []).map((r) => ({
    id: r.id as string,
    full_name: r.full_name as string,
    preferred_name: r.preferred_name as string | null,
    avatar_url: r.avatar_url as string | null,
    job_title: r.job_title as string | null,
    start_date: r.start_date as string | null,
    work_pattern: r.work_pattern as string | null,
    is_external: (r.is_external as boolean) ?? false,
  }));

  // Build on-leave map for peers
  const peerIds = new Set(peerList.map((p) => p.id));
  const onLeaveMap = new Map<string, { leave_type: string; end_date: string }>();
  for (const row of onLeaveRows ?? []) {
    const pid = row.profile_id as string;
    if (peerIds.has(pid)) {
      onLeaveMap.set(pid, {
        leave_type: row.leave_type as string,
        end_date: row.end_date as string,
      });
    }
  }

  const manager = managerData
    ? {
        id: managerData.id as string,
        full_name: managerData.full_name as string,
        avatar_url: managerData.avatar_url as string | null,
        job_title: managerData.job_title as string | null,
      }
    : null;

  return (
    <TeamPeerContent
      peers={peerList}
      manager={manager}
      onLeaveMap={Object.fromEntries(onLeaveMap)}
    />
  );
}
