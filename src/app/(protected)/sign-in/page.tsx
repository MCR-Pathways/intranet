import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getMySchedule } from "./actions";
import { getWeekDates } from "@/lib/sign-in";
import type { WorkingLocationEntry } from "@/lib/sign-in";
import { WorkingLocationContent } from "@/components/sign-in/working-location-content";

export default async function WorkingLocationPage() {
  const { user, profile } = await getCurrentUser();

  if (!user || !profile) {
    redirect("/login");
  }

  // Fetch this week's schedule
  const weekDates = getWeekDates(0);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[weekDates.length - 1];

  // Fetch current month's schedule for the calendar view
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [weekData, monthData] = await Promise.all([
    getMySchedule(weekStart, weekEnd),
    getMySchedule(monthStart, monthEnd),
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
        isManager={profile.is_line_manager ?? false}
      />
    </div>
  );
}
