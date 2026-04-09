"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeekPlanningBanner } from "./week-planning-banner";
import { InteractiveCalendar } from "./interactive-calendar";
import { PendingLeaveList } from "./pending-leave-list";
import { TeamScheduleGrid } from "./team-schedule-grid";
import { TeamCalendar } from "./team-calendar";
import { ReportsPanel } from "./reports-panel";
import { CalendarSyncStatus } from "./calendar-sync-status";
import { LeaveRequestDialog } from "@/components/hr/leave-request-dialog";
import { getWeekDates } from "@/lib/sign-in";
import type { WorkingLocationEntry, WeeklyPatternEntry, TeamMemberSchedule } from "@/lib/sign-in";

interface CalendarSyncStatusData {
  connected: boolean;
  lastSynced: string | null;
}

interface PendingLeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  start_half_day: boolean | null;
  end_half_day: boolean | null;
  total_days: number;
  status: string;
  created_at: string | null;
}

interface WorkingLocationContentProps {
  monthEntries: WorkingLocationEntry[];
  initialPatterns: WeeklyPatternEntry[];
  isManager: boolean;
  initialTeamMembers?: TeamMemberSchedule[];
  calendarSyncStatus?: CalendarSyncStatusData;
  defaultTab?: string;
  pendingLeave?: PendingLeaveRequest[];
  leaveForMonth?: PendingLeaveRequest[];
  publicHolidays?: string[];
}

export function WorkingLocationContent({
  monthEntries,
  initialPatterns,
  isManager,
  initialTeamMembers = [],
  calendarSyncStatus,
  defaultTab = "my-schedule",
  pendingLeave = [],
  leaveForMonth = [],
  publicHolidays = [],
}: WorkingLocationContentProps) {
  // Ref to trigger calendar refresh when patterns are applied
  const calendarRefreshRef = useRef<(() => void) | null>(null);

  // Leave request dialog state
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveDefaultDate, setLeaveDefaultDate] = useState<string | undefined>();

  const handlePatternsApplied = useCallback(() => {
    calendarRefreshRef.current?.();
  }, []);

  const handleNavigateToNextWeek = useCallback(() => {
    // With the month calendar, dismiss the banner — user can navigate freely
  }, []);

  const handleRequestLeave = useCallback((date: string) => {
    setLeaveDefaultDate(date);
    setLeaveDialogOpen(true);
  }, []);

  const calendarConfigured = !!process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ENABLED;

  // Check if next week has no entries — show planning nudge
  const nextWeekDates = useMemo(() => getWeekDates(1), []);
  const nextWeekStart = nextWeekDates[0];
  const nextWeekHasEntries = useMemo(() => {
    const nextWeekSet = new Set(nextWeekDates);
    return monthEntries.some((e) => nextWeekSet.has(e.date));
  }, [monthEntries, nextWeekDates]);
  const hasPatterns = initialPatterns.length > 0;

  return (
    <>
      <Tabs key={defaultTab} defaultValue={defaultTab}>
        <div className="flex items-center justify-between">
          <TabsList variant="line">
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

          {/* Interactive month calendar with day detail panel */}
          <InteractiveCalendar
            initialEntries={monthEntries}
            initialLeave={leaveForMonth}
            isManager={isManager}
            onRequestLeave={handleRequestLeave}
          />

          {/* Pending leave requests */}
          <PendingLeaveList requests={pendingLeave} />
        </TabsContent>

        {isManager && (
          <TabsContent value="team-schedule" className="mt-6 space-y-8">
            {/* Team schedule with week/month toggle */}
            <Tabs defaultValue="team-month">
              <TabsList>
                <TabsTrigger value="team-month">Month</TabsTrigger>
                <TabsTrigger value="team-week">Week</TabsTrigger>
              </TabsList>
              <TabsContent value="team-month" className="mt-4">
                <TeamCalendar initialMembers={initialTeamMembers} />
              </TabsContent>
              <TabsContent value="team-week" className="mt-4">
                <TeamScheduleGrid initialMembers={initialTeamMembers} />
              </TabsContent>
            </Tabs>

            {/* Reports section below team grid */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Reports</h3>
              <ReportsPanel initialMembers={initialTeamMembers} />
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Leave request dialog */}
      <LeaveRequestDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        publicHolidays={publicHolidays}
        defaultStartDate={leaveDefaultDate}
      />
    </>
  );
}
