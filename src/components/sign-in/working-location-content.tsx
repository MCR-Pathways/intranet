"use client";

import { useCallback, useMemo, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeekStrip } from "./week-strip";
import { DefaultWeekEditor } from "./default-week-editor";
import { WeekPlanningBanner } from "./week-planning-banner";
import { TeamScheduleGrid } from "./team-schedule-grid";
import { ReportsPanel } from "./reports-panel";
import { CalendarSyncStatus } from "./calendar-sync-status";
import { PeopleCalendar } from "@/components/shared/people-calendar";
import { getWeekDates } from "@/lib/sign-in";
import type { WorkingLocationEntry, WeeklyPatternEntry, TeamMemberSchedule } from "@/lib/sign-in";

interface CalendarSyncStatusData {
  connected: boolean;
  lastSynced: string | null;
}

interface WorkingLocationContentProps {
  initialEntries: WorkingLocationEntry[];
  monthEntries: WorkingLocationEntry[];
  initialPatterns: WeeklyPatternEntry[];
  isManager: boolean;
  initialTeamMembers?: TeamMemberSchedule[];
  calendarSyncStatus?: CalendarSyncStatusData;
  defaultTab?: string;
}

export function WorkingLocationContent({
  initialEntries,
  monthEntries,
  initialPatterns,
  isManager,
  initialTeamMembers = [],
  calendarSyncStatus,
  defaultTab = "my-schedule",
}: WorkingLocationContentProps) {
  // Ref to trigger WeekStrip refresh when patterns are applied
  const weekStripRef = useRef<{ refresh: () => void }>(null);

  const handlePatternsApplied = useCallback(() => {
    weekStripRef.current?.refresh();
  }, []);

  const handleNavigateToNextWeek = useCallback(() => {
    // WeekStrip handles its own navigation via offset state
    // We just need to trigger a refresh to show next week
    weekStripRef.current?.refresh();
  }, []);

  const calendarConfigured = !!process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ENABLED;

  // Check if next week has no entries — show planning nudge
  const nextWeekDates = useMemo(() => getWeekDates(1), []);
  const nextWeekStart = nextWeekDates[0];
  const nextWeekHasEntries = useMemo(() => {
    const nextWeekSet = new Set(nextWeekDates);
    return initialEntries.some((e) => nextWeekSet.has(e.date));
  }, [initialEntries, nextWeekDates]);
  const hasPatterns = initialPatterns.length > 0;

  return (
    <Tabs key={defaultTab} defaultValue={defaultTab}>
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="my-schedule">My Schedule</TabsTrigger>
          {isManager && (
            <TabsTrigger value="team-schedule">Team Schedule</TabsTrigger>
          )}
        </TabsList>

        {calendarSyncStatus && (
          <CalendarSyncStatus
            connected={calendarSyncStatus.connected}
            lastSynced={calendarSyncStatus.lastSynced}
            calendarConfigured={calendarConfigured}
          />
        )}
      </div>

      <TabsContent value="my-schedule" className="mt-6 space-y-8">
        {/* Week planning nudge — shown when next week is empty */}
        {!nextWeekHasEntries && (
          <WeekPlanningBanner
            nextWeekStart={nextWeekStart}
            hasPatterns={hasPatterns}
            onPatternsApplied={handlePatternsApplied}
            onNavigateToNextWeek={handleNavigateToNextWeek}
          />
        )}

        <WeekStrip ref={weekStripRef} initialEntries={initialEntries} />

        <DefaultWeekEditor
          initialPatterns={initialPatterns}
          onPatternsApplied={handlePatternsApplied}
        />

        {/* Monthly history calendar */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Monthly View</h3>
          <PeopleCalendar
            workingLocations={monthEntries}
            mode="personal"
          />
        </div>
      </TabsContent>

      {isManager && (
        <TabsContent value="team-schedule" className="mt-6 space-y-8">
          <TeamScheduleGrid initialMembers={initialTeamMembers} />

          {/* Reports section below team grid */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Reports</h3>
            <ReportsPanel initialMembers={initialTeamMembers} />
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
}
