import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getMySchedule, getMyPatterns, getTeamSchedule, getCalendarSyncStatus, getMyPendingLeave, getMyLeaveForRange } from "./actions";
import type { WorkingLocationEntry, WeeklyPatternEntry, TeamMemberSchedule } from "@/lib/sign-in";
import { fetchPublicHolidays } from "@/app/(protected)/hr/leave/actions";
import { WorkingLocationContent } from "@/components/sign-in/working-location-content";

export default async function WorkingLocationPage() {
  const { user, profile } = await getCurrentUser();

  if (!user || !profile) {
    redirect("/login");
  }

  const isManager = profile.is_line_manager ?? false;

  // Fetch current month's schedule for the interactive calendar
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const monthStart = `${year}-${month}-01`;
  const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

  const [monthData, patternData, teamData, syncStatus, pendingLeave, leaveForMonth, publicHolidays] = await Promise.all([
    getMySchedule(monthStart, monthEnd),
    getMyPatterns(),
    isManager ? getTeamSchedule(monthStart, monthEnd) : Promise.resolve({ members: [] }),
    getCalendarSyncStatus(),
    getMyPendingLeave(),
    getMyLeaveForRange(monthStart, monthEnd),
    fetchPublicHolidays(profile.region ?? null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Working Location"
        subtitle="Plan and track where you're working"
      />

      <WorkingLocationContent
        monthEntries={monthData.entries as WorkingLocationEntry[]}
        initialPatterns={patternData.patterns as WeeklyPatternEntry[]}
        isManager={isManager}
        initialTeamMembers={teamData.members as TeamMemberSchedule[]}
        calendarSyncStatus={syncStatus}
        pendingLeave={pendingLeave.requests}
        leaveForMonth={leaveForMonth.requests}
        publicHolidays={publicHolidays}
      />
    </div>
  );
}
