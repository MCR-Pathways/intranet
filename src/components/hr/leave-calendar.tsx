"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { LEAVE_TYPE_CONFIG } from "@/lib/hr";
import type { LeaveType } from "@/lib/hr";
import type { LeaveRequest, LeaveRequestWithEmployee } from "@/types/hr";
import { ChevronLeft, ChevronRight } from "lucide-react";

type AnyLeaveRequest = LeaveRequest | LeaveRequestWithEmployee;

interface LeaveCalendarProps {
  requests: AnyLeaveRequest[];
  publicHolidays: { holiday_date: string; name: string }[];
  showEmployee?: boolean;
}

interface CalendarDay {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  leaveEntries: {
    type: LeaveType;
    employeeName?: string;
    isHalfDay?: boolean;
  }[];
}

export function LeaveCalendar({
  requests,
  publicHolidays,
  showEmployee = false,
}: LeaveCalendarProps) {
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());

  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    publicHolidays.forEach((h) => map.set(h.holiday_date, h.name));
    return map;
  }, [publicHolidays]);

  // Build leave lookup: date string → leave entries
  const leaveLookup = useMemo(() => {
    const map = new Map<string, CalendarDay["leaveEntries"]>();
    const approvedRequests = requests.filter((r) => r.status === "approved");

    for (const req of approvedRequests) {
      const start = new Date(req.start_date + "T00:00:00");
      const end = new Date(req.end_date + "T00:00:00");
      const current = new Date(start);

      while (current <= end) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, "0");
        const d = String(current.getDate()).padStart(2, "0");
        const dateStr = `${y}-${m}-${d}`;

        const isStartHalf = req.start_half_day && dateStr === req.start_date;
        const isEndHalf = req.end_half_day && dateStr === req.end_date;

        const entries = map.get(dateStr) ?? [];
        entries.push({
          type: req.leave_type as LeaveType,
          employeeName: showEmployee
            ? (req as LeaveRequestWithEmployee).employee_name
            : undefined,
          isHalfDay: isStartHalf || isEndHalf,
        });
        map.set(dateStr, entries);

        current.setDate(current.getDate() + 1);
      }
    }

    return map;
  }, [requests, showEmployee]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);

    // Start from Monday of the first week
    const startDay = new Date(firstDay);
    const dayOfWeek = startDay.getDay();
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
    startDay.setDate(startDay.getDate() - offset);

    const days: CalendarDay[] = [];
    const current = new Date(startDay);

    // Generate 6 weeks (42 days)
    for (let i = 0; i < 42; i++) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;
      const dow = current.getDay();

      days.push({
        date: new Date(current),
        dateStr,
        isCurrentMonth: current.getMonth() === currentMonth,
        isToday: dateStr === todayStr,
        isWeekend: dow === 0 || dow === 6,
        isHoliday: holidayMap.has(dateStr),
        holidayName: holidayMap.get(dateStr),
        leaveEntries: leaveLookup.get(dateStr) ?? [],
      });

      current.setDate(current.getDate() + 1);
    }

    // Check if we need all 6 rows
    const lastUsedDay = days[41];
    if (lastUsedDay.date.getMonth() !== currentMonth && days[35]?.date.getMonth() !== currentMonth) {
      return days.slice(0, 35);
    }
    return days;
  }, [currentYear, currentMonth, todayStr, holidayMap, leaveLookup]);

  const monthName = new Date(currentYear, currentMonth).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">{monthName}</h3>
        <Button variant="outline" size="sm" onClick={nextMonth}>
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
            className={`bg-background min-h-[80px] p-1 ${
              !day.isCurrentMonth ? "opacity-40" : ""
            } ${day.isWeekend ? "bg-muted/30" : ""} ${
              day.isToday ? "ring-2 ring-primary ring-inset" : ""
            } ${day.isHoliday ? "bg-amber-50" : ""}`}
          >
            <div className="text-xs font-medium mb-1">
              {day.date.getDate()}
            </div>
            {day.isHoliday && (
              <div className="text-[10px] text-amber-700 truncate" title={day.holidayName}>
                {day.holidayName}
              </div>
            )}
            {day.leaveEntries.slice(0, 3).map((entry, i) => {
              const config = LEAVE_TYPE_CONFIG[entry.type];
              return (
                <div
                  key={i}
                  className={`text-[10px] rounded px-1 truncate mt-0.5 ${config?.bgColour ?? "bg-gray-100"} ${config?.colour ?? "text-gray-600"}`}
                  title={`${config?.label ?? entry.type}${entry.employeeName ? ` — ${entry.employeeName}` : ""}${entry.isHalfDay ? " (half day)" : ""}`}
                >
                  {entry.employeeName
                    ? entry.employeeName.split(" ")[0]
                    : config?.label ?? entry.type}
                  {entry.isHalfDay && " ½"}
                </div>
              );
            })}
            {day.leaveEntries.length > 3 && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                +{day.leaveEntries.length - 3} more
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-50 border border-amber-200" />
          Public holiday
        </div>
        {Object.entries(LEAVE_TYPE_CONFIG)
          .filter(([key]) => {
            // Only show types that appear in the data
            return requests.some((r) => r.leave_type === key && r.status === "approved");
          })
          .map(([key, config]) => (
            <div key={key} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded ${config.bgColour}`} />
              {config.label}
            </div>
          ))}
      </div>
    </div>
  );
}
