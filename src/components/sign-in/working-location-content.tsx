"use client";

import { useCallback, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeekStrip } from "./week-strip";
import { DefaultWeekEditor } from "./default-week-editor";
import { TeamScheduleGrid } from "./team-schedule-grid";
import { PeopleCalendar } from "@/components/shared/people-calendar";
import type { WorkingLocationEntry, WeeklyPatternEntry, TeamMemberSchedule } from "@/lib/sign-in";

interface WorkingLocationContentProps {
  initialEntries: WorkingLocationEntry[];
  monthEntries: WorkingLocationEntry[];
  initialPatterns: WeeklyPatternEntry[];
  isManager: boolean;
  initialTeamMembers?: TeamMemberSchedule[];
  defaultTab?: string;
}

export function WorkingLocationContent({
  initialEntries,
  monthEntries,
  initialPatterns,
  isManager,
  initialTeamMembers = [],
  defaultTab = "my-schedule",
}: WorkingLocationContentProps) {
  // Ref to trigger WeekStrip refresh when patterns are applied
  const weekStripRef = useRef<{ refresh: () => void }>(null);

  const handlePatternsApplied = useCallback(() => {
    weekStripRef.current?.refresh();
  }, []);

  return (
    <Tabs key={defaultTab} defaultValue={defaultTab}>
      <TabsList>
        <TabsTrigger value="my-schedule">My Schedule</TabsTrigger>
        {isManager && (
          <TabsTrigger value="team-schedule">Team Schedule</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="my-schedule" className="mt-6 space-y-8">
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
        <TabsContent value="team-schedule" className="mt-6">
          <TeamScheduleGrid initialMembers={initialTeamMembers} />
        </TabsContent>
      )}
    </Tabs>
  );
}
