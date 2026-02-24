import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeaveDashboardContent } from "@/components/hr/leave-dashboard-content";
import { getLeaveYearForDate, getHolidayCalendar, LEAVE_REQUEST_SELECT, LEAVE_REQUEST_WITH_EMPLOYEE_SELECT, mapToLeaveRequestWithEmployee } from "@/lib/hr";
import type { LeaveType, Region } from "@/lib/hr";
import type { LeaveBalance, LeaveRequest, LeaveRequestWithEmployee } from "@/types/hr";

/** Select columns for leave_entitlements. */
const LEAVE_ENTITLEMENT_SELECT =
  "id, profile_id, leave_year_start, leave_year_end, leave_type, base_entitlement_days, fte_at_calculation, adjustments_days, notes";

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab = params.tab || "my-leave";

  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) {
    redirect("/login");
  }

  const leaveYear = getLeaveYearForDate();
  const region = (profile.region as Region | null) ?? null;
  const calendar = getHolidayCalendar(region);

  // Fetch own entitlements, own requests, and public holidays in parallel
  const [
    { data: entitlements },
    { data: myRequests },
    { data: holidays },
  ] = await Promise.all([
    supabase
      .from("leave_entitlements")
      .select(LEAVE_ENTITLEMENT_SELECT)
      .eq("profile_id", user.id)
      .eq("leave_year_start", leaveYear.start),
    supabase
      .from("leave_requests")
      .select(LEAVE_REQUEST_SELECT)
      .eq("profile_id", user.id)
      .gte("start_date", leaveYear.start)
      .lte("start_date", leaveYear.end)
      .order("created_at", { ascending: false }),
    supabase
      .from("public_holidays")
      .select("id, name, holiday_date, region")
      .in("region", [calendar, "all"])
      .eq("year", leaveYear.year)
      .order("holiday_date"),
  ]);

  // Fetch pending approvals if manager or HR admin
  const isManager = profile.is_line_manager === true;
  const isHRAdmin = profile.is_hr_admin === true;

  let pendingApprovals: LeaveRequestWithEmployee[] = [];
  let allRequests: LeaveRequestWithEmployee[] = [];

  if (isManager || isHRAdmin) {
    // Fetch pending requests that need approval (from direct reports or all if HR)
    const { data: pendingData } = await supabase
      .from("leave_requests")
      .select(LEAVE_REQUEST_WITH_EMPLOYEE_SELECT)
      .eq("status", "pending")
      .neq("profile_id", user.id)
      .order("created_at", { ascending: true });

    pendingApprovals = mapToLeaveRequestWithEmployee((pendingData ?? []) as Record<string, unknown>[]);

    // Fetch all requests for calendar / admin view
    const { data: allData } = await supabase
      .from("leave_requests")
      .select(LEAVE_REQUEST_WITH_EMPLOYEE_SELECT)
      .gte("start_date", leaveYear.start)
      .lte("start_date", leaveYear.end)
      .in("status", ["pending", "approved"])
      .order("start_date");

    allRequests = mapToLeaveRequestWithEmployee((allData ?? []) as Record<string, unknown>[]);
  }

  // Build team member map for overlap detection (approver view only)
  const teamMemberMap: Record<string, string[]> = {};

  if ((isManager || isHRAdmin) && pendingApprovals.length > 0) {
    const requesterIds = [...new Set(pendingApprovals.map((r) => r.profile_id))];

    // Fetch each requester's line_manager_id
    const { data: requesterProfiles } = await supabase
      .from("profiles")
      .select("id, line_manager_id")
      .in("id", requesterIds);

    const managerIds = [
      ...new Set(
        (requesterProfiles ?? [])
          .map((p) => p.line_manager_id as string | null)
          .filter(Boolean)
      ),
    ] as string[];

    if (managerIds.length > 0) {
      // Fetch all direct reports of those managers
      const { data: allReports } = await supabase
        .from("profiles")
        .select("id, line_manager_id")
        .in("line_manager_id", managerIds);

      // Build map: requesterId → [teammateIds]
      for (const req of requesterProfiles ?? []) {
        teamMemberMap[req.id as string] = (allReports ?? [])
          .filter(
            (r) =>
              r.line_manager_id === req.line_manager_id && r.id !== req.id
          )
          .map((r) => r.id as string);
      }
    }
  }

  // Calculate leave balances
  const requests = (myRequests ?? []) as LeaveRequest[];
  const balances: LeaveBalance[] = (entitlements ?? []).map((ent) => {
    const leaveType = ent.leave_type as LeaveType;
    const entitlement =
      (ent.base_entitlement_days as number) * (ent.fte_at_calculation as number) +
      (ent.adjustments_days as number);

    const used = requests
      .filter((r) => r.leave_type === leaveType && r.status === "approved")
      .reduce((sum, r) => sum + (r.total_days as number), 0);

    const pending = requests
      .filter((r) => r.leave_type === leaveType && r.status === "pending")
      .reduce((sum, r) => sum + (r.total_days as number), 0);

    return {
      leave_type: leaveType,
      entitlement: Math.round(entitlement * 100) / 100,
      used,
      pending,
      remaining: Math.round((entitlement - used) * 100) / 100,
      available: Math.round((entitlement - used - pending) * 100) / 100,
    };
  });

  const publicHolidayList = (holidays ?? []).map((h) => ({
    holiday_date: h.holiday_date as string,
    name: h.name as string,
  }));

  const profileData = {
    id: user.id,
    full_name: profile.full_name as string,
    region: profile.region as string | null,
    fte: (profile.fte as number) ?? 1,
    is_line_manager: isManager,
    is_hr_admin: isHRAdmin,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leave</h1>
        <p className="text-muted-foreground mt-1">
          Request and manage your leave
        </p>
      </div>

      <LeaveDashboardContent
        profile={profileData}
        balances={balances}
        requests={requests}
        pendingApprovals={pendingApprovals}
        allRequests={allRequests}
        publicHolidays={publicHolidayList}
        activeTab={activeTab}
        teamMemberMap={teamMemberMap}
      />
    </div>
  );
}
