"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import {
  getWeekDates,
  buildDaySchedule,
  formatDayMonth,
  isToday,
  LOCATION_CONFIG,
  NOT_SET_CONFIG,
  OFFICE_LOCATIONS,
  OFFICE_HEADCOUNT_TARGET,
} from "@/lib/sign-in";
import type { TeamMemberSchedule, WorkingLocationEntry } from "@/lib/sign-in";
import { getTeamSchedule } from "@/app/(protected)/sign-in/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

interface TeamScheduleGridProps {
  initialMembers: TeamMemberSchedule[];
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const MIN_WEEK_OFFSET = -2;
const MAX_WEEK_OFFSET = 4;
const OFFICE_LOCATION_SET = new Set<string>(OFFICE_LOCATIONS);

export function TeamScheduleGrid({ initialMembers }: TeamScheduleGridProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [members, setMembers] = useState<TeamMemberSchedule[]>(initialMembers);
  const [, startTransition] = useTransition();

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return "This Week";
    if (weekOffset === 1) return "Next Week";
    if (weekOffset === -1) return "Last Week";
    return `Week of ${formatDayMonth(weekDates[0])}`;
  }, [weekOffset, weekDates]);

  const navigateWeek = useCallback(
    (direction: -1 | 1) => {
      const newOffset = weekOffset + direction;
      if (newOffset < MIN_WEEK_OFFSET || newOffset > MAX_WEEK_OFFSET) return;
      setWeekOffset(newOffset);

      const newDates = getWeekDates(newOffset);
      startTransition(async () => {
        const { members: newMembers } = await getTeamSchedule(
          newDates[0],
          newDates[newDates.length - 1]
        );
        setMembers(newMembers as TeamMemberSchedule[]);
      });
    },
    [weekOffset]
  );

  // Build schedule data per member per day
  const memberSchedules = useMemo(() => {
    return members.map((member) => ({
      ...member,
      daySchedules: weekDates.map((date) =>
        buildDaySchedule(date, member.entries as WorkingLocationEntry[])
      ),
    }));
  }, [members, weekDates]);

  // Compute office count per day (summary row) — checks all time slots
  const officeCounts = useMemo(() => {
    return weekDates.map((date) => {
      let office = 0;
      for (const member of memberSchedules) {
        const schedule = member.daySchedules.find((s) => s.date === date);
        if (!schedule) continue;
        // Count if any slot (fullDay, morning, or afternoon) is an office location
        const isInOffice =
          (schedule.fullDay && OFFICE_LOCATION_SET.has(schedule.fullDay.location)) ||
          (schedule.morning && OFFICE_LOCATION_SET.has(schedule.morning.location)) ||
          (schedule.afternoon && OFFICE_LOCATION_SET.has(schedule.afternoon.location));
        if (isInOffice) office++;
      }
      return office;
    });
  }, [weekDates, memberSchedules]);

  if (members.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No team members"
        description="Direct reports will appear here once assigned."
      />
    );
  }

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigateWeek(-1)}
          disabled={weekOffset <= MIN_WEEK_OFFSET}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">{weekLabel}</h2>
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigateWeek(1)}
          disabled={weekOffset >= MAX_WEEK_OFFSET}
          type="button"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-background">
            <tr>
              <th className="text-left px-3 py-2 border-b min-w-[180px] sticky left-0 z-20 bg-background">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Team Member
                </span>
              </th>
              {weekDates.map((date, i) => (
                <th
                  key={date}
                  className={cn(
                    "text-center px-2 py-2 border-b min-w-[100px]",
                    isToday(date) && "bg-primary/5"
                  )}
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {DAY_LABELS[i]}
                  </span>
                  <br />
                  <span
                    className={cn(
                      "text-xs",
                      isToday(date)
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatDayMonth(date)}
                  </span>
                  {isToday(date) && (
                    <span className="block text-[10px] text-primary font-medium">
                      TODAY
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {memberSchedules.map((member) => (
              <tr
                key={member.id}
                className="border-b hover:bg-muted/30 transition-colors"
              >
                {/* Name cell (sticky left) */}
                <td className="sticky left-0 z-5 bg-background px-3 py-2.5 border-r">
                  <div className="flex items-center gap-2">
                    {member.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.avatar_url}
                        alt={member.preferred_name || member.full_name}
                        className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
                        {getInitials(member.full_name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.preferred_name || member.full_name}
                      </p>
                      {member.job_title && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {member.job_title}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Day cells */}
                {member.daySchedules.map((schedule) => {
                  const hasSplitDay = !schedule.fullDay && (schedule.morning || schedule.afternoon);
                  const entry = schedule.fullDay;
                  const config = entry
                    ? LOCATION_CONFIG[entry.location] ?? NOT_SET_CONFIG
                    : NOT_SET_CONFIG;
                  const isEmpty = !entry && !hasSplitDay;

                  return (
                    <td
                      key={schedule.date}
                      className={cn(
                        "text-center px-2 py-2",
                        isToday(schedule.date) && "bg-primary/5"
                      )}
                    >
                      {isEmpty ? (
                        <span className="inline-flex items-center justify-center border border-dashed border-gray-200 rounded-md px-2 py-1 text-xs text-gray-300">
                          —
                        </span>
                      ) : hasSplitDay ? (
                        <div className="flex flex-col items-center gap-0.5">
                          {schedule.morning && (() => {
                            const mc = LOCATION_CONFIG[schedule.morning!.location] ?? NOT_SET_CONFIG;
                            return (
                              <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium", mc.bgClass, mc.textClass)}>
                                AM <mc.icon className="h-2.5 w-2.5" />
                              </span>
                            );
                          })()}
                          {schedule.afternoon && (() => {
                            const ac = LOCATION_CONFIG[schedule.afternoon!.location] ?? NOT_SET_CONFIG;
                            return (
                              <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium", ac.bgClass, ac.textClass)}>
                                PM <ac.icon className="h-2.5 w-2.5" />
                              </span>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
                              config.bgClass,
                              config.textClass
                            )}
                          >
                            <config.icon className="h-3 w-3" />
                            {config.label === "Other" && entry?.other_location
                              ? entry.other_location
                              : config.shortLabel}
                          </span>
                          {entry?.confirmed && (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          {/* Summary footer */}
          <tfoot>
            <tr className="border-t-2">
              <td className="sticky left-0 z-5 bg-background px-3 py-2 text-xs font-medium text-muted-foreground border-r">
                Office count
              </td>
              {officeCounts.map((count, i) => (
                <td
                  key={weekDates[i]}
                  className={cn(
                    "text-center px-2 py-2 text-xs font-medium",
                    isToday(weekDates[i]) && "bg-primary/5",
                    count < OFFICE_HEADCOUNT_TARGET
                      ? "text-amber-600 font-semibold"
                      : "text-muted-foreground"
                  )}
                >
                  {count}/{members.length} in office
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function TeamScheduleGridSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
      <Skeleton className="h-[300px] rounded-lg" />
    </div>
  );
}
