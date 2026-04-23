"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { LEAVE_TYPE_CONFIG } from "@/lib/hr";
import { LOCATION_CONFIG } from "@/lib/sign-in";
import type { LeaveType } from "@/lib/hr";
import type { LeaveRequest, LeaveRequestWithEmployee } from "@/types/hr";
import type { WorkingLocationEntry } from "@/lib/sign-in";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type AnyLeaveRequest = LeaveRequest | LeaveRequestWithEmployee;

interface PeopleCalendarProps {
  leaveRequests?: AnyLeaveRequest[];
  publicHolidays?: { holiday_date: string; name: string }[];
  workingLocations?: WorkingLocationEntry[];
  showEmployee?: boolean;
  mode: "personal" | "team";
  /** Callback when a day cell is clicked (optional — makes calendar interactive). */
  onDayClick?: (dateStr: string) => void;
  /** Currently selected date for visual highlight (optional). */
  selectedDate?: string | null;
  /** Callback when the displayed month changes (optional — for data fetching). */
  onMonthChange?: (year: number, monthIndex: number) => void;
}

interface CalendarEntry {
  type: "leave" | "location";
  leaveType?: LeaveType;
  locationKey?: string;
  label: string;
  bgClass: string;
  textClass: string;
  isHalfDay?: boolean;
  employeeName?: string;
}

interface CalendarDay {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  entries: CalendarEntry[];
}

export function PeopleCalendar({
  leaveRequests = [],
  publicHolidays = [],
  workingLocations = [],
  showEmployee = false,
  mode,
  onDayClick,
  selectedDate,
  onMonthChange,
}: PeopleCalendarProps) {
  // Single Date reference for all "now" calculations within this render
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }, [today]);
  const [currentMonth, setCurrentMonth] = useState(() => today.getMonth());
  const [currentYear, setCurrentYear] = useState(() => today.getFullYear());

  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    publicHolidays.forEach((h) => map.set(h.holiday_date, h.name));
    return map;
  }, [publicHolidays]);

  // Build leave lookup: date → entries
  const leaveLookup = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    const approved = leaveRequests.filter((r) => r.status === "approved");

    for (const req of approved) {
      const start = new Date(req.start_date + "T00:00:00");
      const end = new Date(req.end_date + "T00:00:00");
      const current = new Date(start);

      while (current <= end) {
        const dateStr = formatDateStr(current);
        const isStartHalf = req.start_half_day && dateStr === req.start_date;
        const isEndHalf = req.end_half_day && dateStr === req.end_date;
        const leaveType = req.leave_type as LeaveType;
        const config = LEAVE_TYPE_CONFIG[leaveType];

        const entries = map.get(dateStr) ?? [];
        entries.push({
          type: "leave",
          leaveType,
          label: showEmployee
            ? (req as LeaveRequestWithEmployee).employee_name?.split(" ")[0] ?? config?.label ?? leaveType
            : config?.label ?? leaveType,
          bgClass: config?.bgColour ?? "bg-gray-100",
          textClass: config?.colour ?? "text-gray-600",
          isHalfDay: !!(isStartHalf || isEndHalf),
          employeeName: showEmployee
            ? (req as LeaveRequestWithEmployee).employee_name
            : undefined,
        });
        map.set(dateStr, entries);
        current.setDate(current.getDate() + 1);
      }
    }
    return map;
  }, [leaveRequests, showEmployee]);

  // Build location lookup: date → entries
  const locationLookup = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();

    for (const loc of workingLocations) {
      // Skip on_leave entries — they're shown as leave entries instead
      if (loc.location === "on_leave") continue;

      const config = LOCATION_CONFIG[loc.location];
      if (!config) continue;

      const entries = map.get(loc.date) ?? [];
      entries.push({
        type: "location",
        locationKey: loc.location,
        label: loc.location === "other" && loc.other_location
          ? loc.other_location
          : config.shortLabel,
        bgClass: config.bgClass,
        textClass: config.textClass,
        isHalfDay: loc.time_slot !== "full_day",
      });
      map.set(loc.date, entries);
    }
    return map;
  }, [workingLocations]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startDay = new Date(firstDay);
    const dayOfWeek = startDay.getDay();
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDay.setDate(startDay.getDate() - offset);

    const days: CalendarDay[] = [];
    const current = new Date(startDay);

    for (let i = 0; i < 42; i++) {
      const dateStr = formatDateStr(current);
      const dow = current.getDay();

      // Merge location + leave entries, locations first
      const locationEntries = locationLookup.get(dateStr) ?? [];
      const leaveEntries = leaveLookup.get(dateStr) ?? [];

      days.push({
        date: new Date(current),
        dateStr,
        isCurrentMonth: current.getMonth() === currentMonth,
        isToday: dateStr === todayStr,
        isWeekend: dow === 0 || dow === 6,
        isHoliday: holidayMap.has(dateStr),
        holidayName: holidayMap.get(dateStr),
        entries: [...locationEntries, ...leaveEntries],
      });

      current.setDate(current.getDate() + 1);
    }

    // Trim to 5 rows if 6th row is all next month
    const lastUsedDay = days[41];
    if (lastUsedDay.date.getMonth() !== currentMonth && days[35]?.date.getMonth() !== currentMonth) {
      return days.slice(0, 35);
    }
    return days;
  }, [currentYear, currentMonth, todayStr, holidayMap, leaveLookup, locationLookup]);

  // Year dropdown: starts from 2026 (system launch, no historical data).
  // Google Calendar uses infinite chevron navigation; since we use a dropdown,
  // extend to whichever is further: current year + 5 or the viewed year + 2.
  const thisYear = today.getFullYear();
  const maxYear = Math.max(thisYear + 5, currentYear + 2);
  const yearOptions = Array.from({ length: maxYear - 2026 + 1 }, (_, i) => 2026 + i);

  function prevMonth() {
    const newMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const newYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
    onMonthChange?.(newYear, newMonth);
  }

  function nextMonth() {
    const newMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const newYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
    onMonthChange?.(newYear, newMonth);
  }

  const isCurrentMonth = currentMonth === today.getMonth() && currentYear === today.getFullYear();

  function handleMonthSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const newMonth = Number(e.target.value);
    setCurrentMonth(newMonth);
    onMonthChange?.(currentYear, newMonth);
  }

  function handleYearSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const newYear = Number(e.target.value);
    setCurrentYear(newYear);
    onMonthChange?.(newYear, currentMonth);
  }

  function goToToday() {
    const now = new Date();
    setCurrentMonth(now.getMonth());
    setCurrentYear(now.getFullYear());
    onMonthChange?.(now.getFullYear(), now.getMonth());
  }

  // Build legend — only show types that appear in data
  const activeLocationTypes = useMemo(() => {
    const keys = new Set<string>();
    for (const loc of workingLocations) {
      if (loc.location !== "on_leave") keys.add(loc.location);
    }
    return Array.from(keys);
  }, [workingLocations]);

  const activeLeaveTypes = useMemo(() => {
    const keys = new Set<string>();
    for (const req of leaveRequests) {
      if (req.status === "approved") keys.add(req.leave_type);
    }
    return Array.from(keys);
  }, [leaveRequests]);

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" className="bg-card" onClick={prevMonth} type="button">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <select
            value={currentMonth}
            onChange={handleMonthSelect}
            className="text-lg font-semibold bg-transparent border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring rounded px-1"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
          <select
            value={currentYear}
            onChange={handleYearSelect}
            className="text-lg font-semibold bg-transparent border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring rounded px-1"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          {!isCurrentMonth && (
            <Button variant="ghost" size="sm" onClick={goToToday} type="button">
              Today
            </Button>
          )}
        </div>
        <Button variant="outline" size="sm" className="bg-card" onClick={nextMonth} type="button">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
        {/* Day headers */}
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div
            key={day}
            className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}

        {/* Day cells */}
        {calendarDays.map((day) => (
          <div
            key={day.dateStr}
            role={onDayClick ? "button" : undefined}
            tabIndex={onDayClick && day.isCurrentMonth ? 0 : undefined}
            onClick={onDayClick && day.isCurrentMonth ? () => onDayClick(day.dateStr) : undefined}
            onKeyDown={onDayClick && day.isCurrentMonth ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onDayClick(day.dateStr);
              }
            } : undefined}
            className={`bg-background min-h-[80px] p-1 ${
              !day.isCurrentMonth ? "opacity-40" : ""
            } ${day.isWeekend ? "bg-muted/30" : ""} ${
              day.isHoliday ? "bg-amber-50" : ""
            } ${selectedDate === day.dateStr ? "bg-primary/5" : ""
            } ${onDayClick && day.isCurrentMonth ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""}`}
          >
            <div className={`text-xs font-medium mb-1 ${
              day.isToday
                ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground"
                : ""
            }`}>
              {day.date.getDate()}
            </div>
            {day.isHoliday && (
              <div className="text-[10px] text-amber-700 truncate" title={day.holidayName}>
                {day.holidayName}
              </div>
            )}
            {day.entries.slice(0, 3).map((entry, i) => (
              <div
                key={i}
                className={`text-[10px] rounded px-1 truncate mt-0.5 ${entry.bgClass} ${entry.textClass}`}
                title={`${entry.label}${entry.employeeName ? ` — ${entry.employeeName}` : ""}${entry.isHalfDay ? " (half day)" : ""}`}
              >
                {entry.label}
                {entry.isHalfDay && " ½"}
              </div>
            ))}
            {day.entries.length > 3 && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                +{day.entries.length - 3} more
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {publicHolidays.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-50 border border-amber-200" />
            Public holiday
          </div>
        )}
        {activeLocationTypes.map((key) => {
          const config = LOCATION_CONFIG[key];
          if (!config) return null;
          return (
            <div key={key} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded ${config.bgClass}`} />
              {config.label}
            </div>
          );
        })}
        {mode === "team" && activeLeaveTypes.map((key) => {
          const config = LEAVE_TYPE_CONFIG[key as LeaveType];
          if (!config) return null;
          return (
            <div key={key} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded ${config.bgColour}`} />
              {config.label}
            </div>
          );
        })}
        {mode === "personal" && activeLeaveTypes.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-rose-50" />
            On Leave
          </div>
        )}
      </div>
    </div>
  );
}

export function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
