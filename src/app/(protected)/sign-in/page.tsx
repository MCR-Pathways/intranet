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
  const startDate = weekDates[0];
  const endDate = weekDates[weekDates.length - 1];
  const { entries } = await getMySchedule(startDate, endDate);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Working Location"
        subtitle="Plan and track where you're working"
      />

      <WorkingLocationContent
        initialEntries={entries as WorkingLocationEntry[]}
        isManager={profile.is_line_manager ?? false}
      />
    </div>
  );
}
