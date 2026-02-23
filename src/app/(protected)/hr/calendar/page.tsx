import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeaveCalendar } from "@/components/hr/leave-calendar";
import type { LeaveRequestWithEmployee } from "@/types/hr";

export default async function CalendarPage() {
  const { supabase, profile } = await getCurrentUser();
  if (!profile) redirect("/login");

  const isHRAdmin = profile.is_hr_admin ?? false;
  const isLineManager = profile.is_line_manager ?? false;

  // Determine which leave requests to show
  let leaveRequests: LeaveRequestWithEmployee[] = [];

  if (isHRAdmin) {
    // HR admins see all approved leave
    const { data } = await supabase
      .from("leave_requests")
      .select(
        "id, profile_id, leave_type, start_date, end_date, start_half_day, end_half_day, total_days, reason, status, decided_by, decided_at, decision_notes, rejection_reason, created_at, profiles!leave_requests_profile_id_fkey(full_name, avatar_url, job_title)",
      )
      .eq("status", "approved");

    leaveRequests = (data ?? []).map((r) => {
      const emp = r.profiles as unknown as {
        full_name: string;
        avatar_url: string | null;
        job_title: string | null;
      } | null;
      return {
        id: r.id as string,
        profile_id: r.profile_id as string,
        leave_type: r.leave_type as LeaveRequestWithEmployee["leave_type"],
        start_date: r.start_date as string,
        end_date: r.end_date as string,
        start_half_day: r.start_half_day as boolean,
        end_half_day: r.end_half_day as boolean,
        total_days: r.total_days as number,
        reason: r.reason as string | null,
        status: r.status as LeaveRequestWithEmployee["status"],
        decided_by: r.decided_by as string | null,
        decided_at: r.decided_at as string | null,
        decision_notes: r.decision_notes as string | null,
        rejection_reason: r.rejection_reason as string | null,
        created_at: r.created_at as string,
        employee_name: emp?.full_name ?? "Unknown",
        employee_avatar: emp?.avatar_url ?? null,
        employee_job_title: emp?.job_title ?? null,
      };
    });
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
        .select(
          "id, profile_id, leave_type, start_date, end_date, start_half_day, end_half_day, total_days, reason, status, decided_by, decided_at, decision_notes, rejection_reason, created_at, profiles!leave_requests_profile_id_fkey(full_name, avatar_url, job_title)",
        )
        .in("profile_id", reportIds)
        .eq("status", "approved");

      leaveRequests = (data ?? []).map((r) => {
        const emp = r.profiles as unknown as {
          full_name: string;
          avatar_url: string | null;
          job_title: string | null;
        } | null;
        return {
          id: r.id as string,
          profile_id: r.profile_id as string,
          leave_type: r.leave_type as LeaveRequestWithEmployee["leave_type"],
          start_date: r.start_date as string,
          end_date: r.end_date as string,
          start_half_day: r.start_half_day as boolean,
          end_half_day: r.end_half_day as boolean,
          total_days: r.total_days as number,
          reason: r.reason as string | null,
          status: r.status as LeaveRequestWithEmployee["status"],
          decided_by: r.decided_by as string | null,
          decided_at: r.decided_at as string | null,
          decision_notes: r.decision_notes as string | null,
          rejection_reason: r.rejection_reason as string | null,
          created_at: r.created_at as string,
          employee_name: emp?.full_name ?? "Unknown",
          employee_avatar: emp?.avatar_url ?? null,
          employee_job_title: emp?.job_title ?? null,
        };
      });
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
