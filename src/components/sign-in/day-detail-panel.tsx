"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { X, CalendarPlus, CheckCircle2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickSetIcons } from "./quick-set-icons";
import { LOCATION_CONFIG, getLocationLabel } from "@/lib/sign-in";
import { LEAVE_TYPE_CONFIG } from "@/lib/hr";
import type { LeaveType } from "@/lib/hr";
import type { WorkingLocationEntry } from "@/lib/sign-in";
import { getTeamContextForDate } from "@/app/(protected)/sign-in/actions";
import { getInitials } from "@/lib/utils";

interface LeaveEntry {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface DayDetailPanelProps {
  date: string;
  entries: WorkingLocationEntry[];
  leaveEntries: LeaveEntry[];
  isManager: boolean;
  onClose: () => void;
  onRequestLeave: (date: string) => void;
  onLocationChanged: () => void;
}

interface TeamMemberContext {
  id: string;
  name: string;
  avatarUrl: string | null;
  location: string | null;
  otherLocation: string | null;
  confirmed: boolean;
}

export function DayDetailPanel({
  date,
  entries,
  leaveEntries,
  isManager,
  onClose,
  onRequestLeave,
  onLocationChanged,
}: DayDetailPanelProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMemberContext[]>([]);
  const [, startTransition] = useTransition();

  const dateObj = new Date(date + "T00:00:00");
  const formattedDate = dateObj.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isPast = date < todayStr;
  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

  // Get the current full-day location
  const fullDayEntry = entries.find((e) => e.time_slot === "full_day");
  const morningEntry = entries.find((e) => e.time_slot === "morning");
  const afternoonEntry = entries.find((e) => e.time_slot === "afternoon");

  const currentLocation = fullDayEntry?.location ?? morningEntry?.location ?? null;
  const isOnLeave = entries.some((e) => e.location === "on_leave");

  // Find leave entries that overlap this date
  const leavesForDay = leaveEntries.filter(
    (l) => l.start_date <= date && l.end_date >= date
  );

  // Fetch team context when date changes
  const fetchTeamContext = useCallback(() => {
    if (!isManager) return;
    startTransition(async () => {
      const result = await getTeamContextForDate(date);
      setTeamMembers(result.members);
    });
  }, [date, isManager]);

  useEffect(() => {
    fetchTeamContext();
  }, [fetchTeamContext]);

  // Source indicator
  const sourceEntry = fullDayEntry ?? morningEntry ?? afternoonEntry;
  const sourceLabel = sourceEntry?.source === "calendar"
    ? "Google Calendar"
    : sourceEntry?.source === "pattern"
      ? "Weekly pattern"
      : sourceEntry?.source === "manual"
        ? "Set manually"
        : null;

  return (
    <div className="border-l bg-background w-full lg:w-96 flex-shrink-0 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b">
        <div>
          <h3 className="font-semibold text-sm">{formattedDate}</h3>
          {isWeekend && (
            <span className="text-xs text-muted-foreground">Weekend</span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground -mt-0.5"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-6">
        {/* Working Location Section */}
        {!isWeekend && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Working Location
            </h4>

            {isOnLeave ? (
              <div className="flex items-center gap-2 rounded-md bg-rose-50 px-3 py-2">
                <div className="h-2 w-2 rounded-full bg-rose-400" />
                <span className="text-sm font-medium text-rose-700">
                  On Leave
                  {leavesForDay.length > 0 && ` — ${LEAVE_TYPE_CONFIG[leavesForDay[0].leave_type as LeaveType]?.label ?? leavesForDay[0].leave_type}`}
                </span>
              </div>
            ) : (
              <QuickSetIcons
                date={date}
                currentLocation={currentLocation}
                isOnLeave={isOnLeave}
                isPast={isPast}
                onLocationSet={onLocationChanged}
              />
            )}

            {/* Split day indicator */}
            {morningEntry && afternoonEntry && !fullDayEntry && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium w-8">AM:</span>
                  <span>{getLocationLabel(morningEntry.location, morningEntry.other_location)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium w-8">PM:</span>
                  <span>{getLocationLabel(afternoonEntry.location, afternoonEntry.other_location)}</span>
                </div>
              </div>
            )}

            {/* Confirmed indicator */}
            {sourceEntry?.confirmed && sourceEntry.confirmed_at && (
              <div className="flex items-center gap-1.5 text-xs text-teal-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirmed at{" "}
                {new Date(sourceEntry.confirmed_at).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/London",
                })}
              </div>
            )}

            {/* Source indicator */}
            {sourceLabel && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Source: {sourceLabel}
              </div>
            )}
          </div>
        )}

        {/* Leave Section */}
        {!isWeekend && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Leave
            </h4>

            {leavesForDay.length > 0 ? (
              <div className="space-y-2">
                {leavesForDay.map((leave) => {
                  const config = LEAVE_TYPE_CONFIG[leave.leave_type as LeaveType];
                  return (
                    <div
                      key={leave.id}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 ${config?.bgColour ?? "bg-gray-50"}`}
                    >
                      <div className={`h-2 w-2 rounded-full ${leave.status === "pending" ? "bg-amber-400" : (config?.colour ?? "text-gray-600").replace("text-", "bg-")}`} />
                      <span className={`text-sm font-medium ${config?.colour ?? "text-gray-700"}`}>
                        {config?.label ?? leave.leave_type}
                      </span>
                      {leave.status === "pending" && (
                        <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full ml-auto">
                          Pending
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No leave for this day</p>
            )}

            {!isPast && (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => onRequestLeave(date)}
                className="w-full"
              >
                <CalendarPlus className="h-4 w-4 mr-1.5" />
                Request Leave
              </Button>
            )}
          </div>
        )}

        {/* Team Context Section (managers only) */}
        {isManager && !isWeekend && teamMembers.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Team
            </h4>
            <div className="space-y-1.5">
              {teamMembers.map((member) => {
                const locConfig = member.location ? LOCATION_CONFIG[member.location] : null;
                return (
                  <div key={member.id} className="flex items-center gap-2 text-sm">
                    {member.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.avatarUrl}
                        alt={member.name}
                        className="h-6 w-6 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0">
                        {getInitials(member.name)}
                      </div>
                    )}
                    <span className="truncate flex-1">{member.name}</span>
                    {member.location ? (
                      <span className={`text-xs ${locConfig?.textClass ?? "text-gray-500"}`}>
                        {getLocationLabel(member.location, member.otherLocation)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
