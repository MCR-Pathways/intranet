import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getMySchedule } from "./actions";
import { getWeekDates } from "@/lib/sign-in";
import { LocationBadge } from "@/components/sign-in/location-badge";

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

      {/* Temporary placeholder — full week planner UI coming in Phase 2 */}
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">This Week</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No schedule set for this week. The week planner is coming soon.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-24">
                  {new Date(entry.date + "T00:00:00").toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <LocationBadge
                  location={entry.location}
                  otherLocation={entry.other_location}
                />
                {entry.confirmed && (
                  <span className="text-xs text-emerald-600">Confirmed</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
