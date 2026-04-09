"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { PeopleCalendar } from "@/components/shared/people-calendar";
import { DayDetailPanel } from "./day-detail-panel";
import type { WorkingLocationEntry } from "@/lib/sign-in";
import type { LeaveRequest } from "@/types/hr";
import type { LeaveType } from "@/lib/hr";
import { getMySchedule, getMyLeaveForRange } from "@/app/(protected)/sign-in/actions";

interface LeaveEntry {
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

interface InteractiveCalendarProps {
  initialEntries: WorkingLocationEntry[];
  initialLeave: LeaveEntry[];
  isManager: boolean;
  onRequestLeave: (date: string) => void;
}

export function InteractiveCalendar({
  initialEntries,
  initialLeave,
  isManager,
  onRequestLeave,
}: InteractiveCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [entries, setEntries] = useState<WorkingLocationEntry[]>(initialEntries);
  const [leaveEntries, setLeaveEntries] = useState<LeaveEntry[]>(initialLeave);
  const [, startTransition] = useTransition();

  // Track current month for fetching data on navigation
  const [currentMonthKey, setCurrentMonthKey] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Cache of previously fetched months
  const [monthCache, setMonthCache] = useState<Map<string, { entries: WorkingLocationEntry[]; leave: LeaveEntry[] }>>(() => {
    const cache = new Map();
    cache.set(currentMonthKey, { entries: initialEntries, leave: initialLeave });
    return cache;
  });

  const fetchMonthData = useCallback((year: number, month: number) => {
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;

    // Check cache first
    const cached = monthCache.get(key);
    if (cached) {
      setEntries(cached.entries);
      setLeaveEntries(cached.leave);
      setCurrentMonthKey(key);
      return;
    }

    const lastDay = new Date(year, month + 1, 0).getDate();
    const monthStr = String(month + 1).padStart(2, "0");
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

    setCurrentMonthKey(key);

    startTransition(async () => {
      const [scheduleResult, leaveResult] = await Promise.all([
        getMySchedule(startDate, endDate),
        getMyLeaveForRange(startDate, endDate),
      ]);

      const newEntries = scheduleResult.entries as WorkingLocationEntry[];
      const newLeave = leaveResult.requests as LeaveEntry[];

      setEntries(newEntries);
      setLeaveEntries(newLeave);

      // Update cache
      setMonthCache((prev) => {
        const next = new Map(prev);
        next.set(key, { entries: newEntries, leave: newLeave });
        return next;
      });
    });
  }, [monthCache]);

  const handleDayClick = useCallback((dateStr: string) => {
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr));
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedDate(null);
  }, []);

  const handleLocationChanged = useCallback(() => {
    // Re-fetch current month data to refresh the calendar
    const [yearStr, monthStr] = currentMonthKey.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Clear cache for this month to force re-fetch
    setMonthCache((prev) => {
      const next = new Map(prev);
      next.delete(currentMonthKey);
      return next;
    });

    startTransition(async () => {
      const [scheduleResult, leaveResult] = await Promise.all([
        getMySchedule(startDate, endDate),
        getMyLeaveForRange(startDate, endDate),
      ]);

      const newEntries = scheduleResult.entries as WorkingLocationEntry[];
      const newLeave = leaveResult.requests as LeaveEntry[];

      setEntries(newEntries);
      setLeaveEntries(newLeave);

      // Re-cache
      setMonthCache((prev) => {
        const next = new Map(prev);
        next.set(currentMonthKey, { entries: newEntries, leave: newLeave });
        return next;
      });
    });
  }, [currentMonthKey]);

  // Get entries and leave for the selected date
  const selectedDayEntries = useMemo(() => {
    if (!selectedDate) return [];
    return entries.filter((e) => e.date === selectedDate);
  }, [entries, selectedDate]);

  const selectedDayLeave = useMemo(() => {
    if (!selectedDate) return [];
    return leaveEntries.filter(
      (l) => l.start_date <= selectedDate && l.end_date >= selectedDate
    );
  }, [leaveEntries, selectedDate]);

  // Build leave requests in the format PeopleCalendar expects
  const calendarLeaveRequests = useMemo((): LeaveRequest[] => {
    return leaveEntries.map((l) => ({
      id: l.id,
      profile_id: "",
      leave_type: l.leave_type as LeaveType,
      start_date: l.start_date,
      end_date: l.end_date,
      start_half_day: l.start_half_day,
      end_half_day: l.end_half_day,
      total_days: l.total_days,
      reason: null,
      status: l.status as LeaveRequest["status"],
      decided_by: null,
      decided_at: null,
      decision_notes: null,
      rejection_reason: null,
      created_at: l.created_at,
    }));
  }, [leaveEntries]);

  return (
    <div className="flex flex-col lg:flex-row gap-0 rounded-md border overflow-hidden">
      {/* Calendar grid */}
      <div className={`flex-1 min-w-0 p-4 ${selectedDate ? "lg:border-r-0" : ""}`}>
        <PeopleCalendar
          workingLocations={entries}
          leaveRequests={calendarLeaveRequests}
          mode="personal"
          onDayClick={handleDayClick}
          selectedDate={selectedDate}
          onMonthChange={fetchMonthData}
        />
      </div>

      {/* Day detail panel — shown when a day is selected */}
      {selectedDate && (
        <DayDetailPanel
          date={selectedDate}
          entries={selectedDayEntries}
          leaveEntries={selectedDayLeave}
          isManager={isManager}
          onClose={handleClosePanel}
          onRequestLeave={onRequestLeave}
          onLocationChanged={handleLocationChanged}
        />
      )}
    </div>
  );
}
