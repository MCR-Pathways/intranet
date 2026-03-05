"use client";

import { useState, useMemo, useCallback, useTransition, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getWeekDates, buildDaySchedule, formatDayMonth } from "@/lib/sign-in";
import type { WorkingLocationEntry, DaySchedule } from "@/lib/sign-in";
import type { WorkLocation, TimeSlot } from "@/types/database.types";
import { getMySchedule } from "@/app/(protected)/sign-in/actions";
import { DayCell } from "./day-cell";
import { LocationPickerDialog } from "./location-picker-dialog";

export interface WeekStripHandle {
  refresh: () => void;
}

interface WeekStripProps {
  initialEntries: WorkingLocationEntry[];
}

export const WeekStrip = forwardRef<WeekStripHandle, WeekStripProps>(function WeekStrip(
  { initialEntries },
  ref
) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<WorkingLocationEntry[]>(initialEntries);
  const [, startTransition] = useTransition();

  // Expose refresh method for parent to re-fetch current week data
  useImperativeHandle(ref, () => ({
    refresh: () => {
      const dates = getWeekDates(weekOffset);
      startTransition(async () => {
        const { entries: newEntries } = await getMySchedule(
          dates[0],
          dates[dates.length - 1]
        );
        setEntries(newEntries as WorkingLocationEntry[]);
      });
    },
  }), [weekOffset]);

  // Picker dialog state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState("");
  const [pickerTimeSlot, setPickerTimeSlot] = useState<TimeSlot>("full_day");

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const schedules: DaySchedule[] = useMemo(
    () => weekDates.map((date) => buildDaySchedule(date, entries)),
    [weekDates, entries]
  );

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return "This Week";
    if (weekOffset === 1) return "Next Week";
    if (weekOffset === -1) return "Last Week";
    return `Week of ${formatDayMonth(weekDates[0])}`;
  }, [weekOffset, weekDates]);

  const navigateWeek = useCallback(
    (direction: -1 | 1) => {
      const newOffset = weekOffset + direction;
      // Limit: 2 weeks past, 4 weeks ahead
      if (newOffset < -2 || newOffset > 4) return;

      setWeekOffset(newOffset);

      // Fetch new week's data
      const newDates = getWeekDates(newOffset);
      startTransition(async () => {
        const { entries: newEntries } = await getMySchedule(
          newDates[0],
          newDates[newDates.length - 1]
        );
        setEntries(newEntries as WorkingLocationEntry[]);
      });
    },
    [weekOffset]
  );

  const handleDayCellClick = useCallback((date: string, timeSlot: TimeSlot) => {
    setPickerDate(date);
    setPickerTimeSlot(timeSlot);
    setPickerOpen(true);
  }, []);

  const handleOptimisticUpdate = useCallback(
    (date: string, timeSlot: TimeSlot, location: WorkLocation | null, otherLocation?: string) => {
      setEntries((prev) => {
        if (location === null) {
          // Clear: remove the entry
          return prev.filter(
            (e) => !(e.date === date && e.time_slot === timeSlot)
          );
        }

        // Clean up conflicting entries: full_day and split-day can't coexist
        let cleaned = prev;
        if (timeSlot === "full_day") {
          // Setting full_day → remove morning/afternoon for this date
          cleaned = prev.filter(
            (e) => !(e.date === date && (e.time_slot === "morning" || e.time_slot === "afternoon"))
          );
        } else {
          // Setting morning/afternoon → remove full_day for this date
          cleaned = prev.filter(
            (e) => !(e.date === date && e.time_slot === "full_day")
          );
        }

        // Upsert: replace or add
        const existing = cleaned.find(
          (e) => e.date === date && e.time_slot === timeSlot
        );
        if (existing) {
          return cleaned.map((e) =>
            e.date === date && e.time_slot === timeSlot
              ? { ...e, location, other_location: otherLocation ?? null, source: "manual" as const }
              : e
          );
        }

        return [
          ...cleaned,
          {
            id: `optimistic-${date}-${timeSlot}`,
            user_id: "",
            date,
            time_slot: timeSlot,
            location,
            other_location: otherLocation ?? null,
            source: "manual" as const,
            confirmed: false,
            confirmed_at: null,
            leave_request_id: null,
          },
        ];
      });
    },
    []
  );

  const pickerSchedule = useMemo(
    () => buildDaySchedule(pickerDate, entries),
    [pickerDate, entries]
  );

  return (
    <div className="max-w-3xl">
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigateWeek(-1)}
          disabled={weekOffset <= -2}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">{weekLabel}</h2>
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigateWeek(1)}
          disabled={weekOffset >= 4}
          type="button"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-5 gap-3">
        {schedules.map((schedule) => (
          <DayCell
            key={schedule.date}
            schedule={schedule}
            onClick={handleDayCellClick}
          />
        ))}
      </div>

      {/* Location picker dialog — key forces remount when date/slot changes */}
      {pickerDate && (
        <LocationPickerDialog
          key={`${pickerDate}-${pickerTimeSlot}`}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          date={pickerDate}
          timeSlot={pickerTimeSlot}
          schedule={pickerSchedule}
          onOptimisticUpdate={handleOptimisticUpdate}
        />
      )}
    </div>
  );
});

export function WeekStripSkeleton() {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
