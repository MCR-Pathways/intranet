import { getCurrentUser, isHRAdminEffective } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeaveCalendar } from "@/components/hr/leave-calendar";
import { LEAVE_REQUEST_WITH_EMPLOYEE_SELECT, mapToLeaveRequestWithEmployee } from "@/lib/hr";
import type { LeaveRequestWithEmployee } from "@/types/hr";

export default async function CalendarPage() {
  const { supabase, profile } = await getCurrentUser();
  if (!profile) redirect("/login");

  const isHRAdmin = isHRAdminEffective(profile);
  const isLineManager = profile.is_line_manager ?? false;

  // Determine which leave requests to show
  let leaveRequests: LeaveRequestWithEmployee[] = [];

  if (isHRAdmin) {
    // HR admins see all approved leave
    const { data } = await supabase
      .from("leave_requests")
      .select(LEAVE_REQUEST_WITH_EMPLOYEE_SELECT)
      .eq("status", "approved");

    leaveRequests = mapToLeaveRequestWithEmployee((data ?? []) as Record<string, unknown>[]);
  } else if (isLineManager) {
    // Line managers see their direct reports' approved leave
    const { data: reports } = await supabase
      .from("profiles")
      .select("id")
      .eq("line_manager_id", profile.id);

    const reportIds = (reports ?? []).map((r) => r.id as string);

    if (reportIds.length > 0) {
      const { data } = await supabase
        .from("leave_requests")
        .select(LEAVE_REQUEST_WITH_EMPLOYEE_SELECT)
        .in("profile_id", reportIds)
        .eq("status", "approved");

      leaveRequests = mapToLeaveRequestWithEmployee((data ?? []) as Record<string, unknown>[]);
    }
  }

  // Fetch public holidays
  const { data: publicHolidayRows } = await supabase
    .from("public_holidays")
    .select("holiday_date, name");

  const publicHolidays = (publicHolidayRows ?? []).map((h) => ({
    holiday_date: h.holiday_date as string,
    name: h.name as string,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Calendar</h1>
        <p className="text-muted-foreground mt-1">
          {isHRAdmin
            ? "View approved leave across the organisation"
            : isLineManager
              ? "View your team's approved leave"
              : "View your schedule and events"}
        </p>
      </div>

      {!isHRAdmin && !isLineManager ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          <p>The team calendar is available to line managers and HR administrators.</p>
        </div>
      ) : (
        <LeaveCalendar
          requests={leaveRequests}
          publicHolidays={publicHolidays}
          showEmployee
        />
      )}
    </div>
  );
}
