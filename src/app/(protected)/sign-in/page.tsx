import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getMySchedule, getMyPatterns, getTeamSchedule, getCalendarSyncStatus } from "./actions";
import { getWeekDates } from "@/lib/sign-in";
import type { WorkingLocationEntry, WeeklyPatternEntry, TeamMemberSchedule } from "@/lib/sign-in";
import { WorkingLocationContent } from "@/components/sign-in/working-location-content";

export default async function WorkingLocationPage() {
  const { user, profile } = await getCurrentUser();

  if (!user || !profile) {
    redirect("/login");
  }

  const isManager = profile.is_line_manager ?? false;

  // Fetch this week's schedule
  const weekDates = getWeekDates(0);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[weekDates.length - 1];

  // Fetch current month's schedule for the calendar view
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const monthStart = `${year}-${month}-01`;
  const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

  const [weekData, monthData, patternData, teamData, syncStatus] = await Promise.all([
    getMySchedule(weekStart, weekEnd),
    getMySchedule(monthStart, monthEnd),
    getMyPatterns(),
    isManager ? getTeamSchedule(weekStart, weekEnd) : Promise.resolve({ members: [] }),
    getCalendarSyncStatus(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Working Location"
        subtitle="Plan and track where you're working"
      />

      <WorkingLocationContent
        initialEntries={weekData.entries as WorkingLocationEntry[]}
        monthEntries={monthData.entries as WorkingLocationEntry[]}
        initialPatterns={patternData.patterns as WeeklyPatternEntry[]}
        isManager={isManager}
        initialTeamMembers={teamData.members as TeamMemberSchedule[]}
        calendarSyncStatus={syncStatus}
      />
    </div>
  );
}
