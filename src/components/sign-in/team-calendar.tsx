"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PeopleCalendar } from "@/components/shared/people-calendar";
import { LOCATION_CONFIG, getLocationLabel } from "@/lib/sign-in";
import type { TeamMemberSchedule, WorkingLocationEntry } from "@/lib/sign-in";
import type { LeaveRequestWithEmployee } from "@/types/hr";
import type { LeaveType } from "@/lib/hr";
import { getTeamSchedule } from "@/app/(protected)/sign-in/actions";
import { getInitials } from "@/lib/utils";
import { Users, Filter } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface TeamCalendarProps {
  initialMembers: TeamMemberSchedule[];
}

export function TeamCalendar({ initialMembers }: TeamCalendarProps) {
  const [members, setMembers] = useState<TeamMemberSchedule[]>(initialMembers);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("__all__");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Filtered members based on dropdown selection
  const filteredMembers = useMemo(() => {
    if (selectedMemberId === "__all__") return members;
    return members.filter((m) => m.id === selectedMemberId);
  }, [members, selectedMemberId]);

  // Build combined working locations for the PeopleCalendar (team mode)
  const allEntries = useMemo(() => {
    const entries: WorkingLocationEntry[] = [];
    for (const member of filteredMembers) {
      for (const entry of member.entries) {
        entries.push(entry as WorkingLocationEntry);
      }
    }
    return entries;
  }, [filteredMembers]);

  // Build leave-request-like objects from on_leave entries with employee names
  const teamLeaveRequests = useMemo((): LeaveRequestWithEmployee[] => {
    const requests: LeaveRequestWithEmployee[] = [];

    for (const member of filteredMembers) {
      const leaveEntries = (member.entries as WorkingLocationEntry[]).filter(
        (e) => e.location === "on_leave"
      );

      // Group consecutive leave entries per member into a single "request"
      for (const entry of leaveEntries) {
        requests.push({
          id: `${member.id}-${entry.date}`,
          profile_id: member.id,
          leave_type: (entry.other_location ?? "annual") as LeaveType,
          start_date: entry.date,
          end_date: entry.date,
          start_half_day: entry.time_slot === "afternoon",
          end_half_day: entry.time_slot === "morning",
          total_days: entry.time_slot === "full_day" ? 1 : 0.5,
          reason: null,
          status: "approved" as const,
          decided_by: null,
          decided_at: null,
          decision_notes: null,
          rejection_reason: null,
          created_at: "",
          employee_name: member.preferred_name || member.full_name,
          employee_avatar: member.avatar_url,
          employee_job_title: member.job_title,
        });
      }
    }

    return requests;
  }, [filteredMembers]);

  // Handle month change — fetch new data
  const handleMonthChange = useCallback((year: number, monthIndex: number) => {
    const monthStr = String(monthIndex + 1).padStart(2, "0");
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

    startTransition(async () => {
      const { members: newMembers } = await getTeamSchedule(startDate, endDate);
      setMembers(newMembers as TeamMemberSchedule[]);
    });
  }, []);

  const handleDayClick = useCallback((dateStr: string) => {
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr));
  }, []);

  // Get members visible on selected date
  const selectedDayMembers = useMemo(() => {
    if (!selectedDate) return [];
    return filteredMembers
      .map((member) => {
        const dayEntries = (member.entries as WorkingLocationEntry[]).filter(
          (e) => e.date === selectedDate
        );
        const entry = dayEntries.find((e) => e.time_slot === "full_day") ?? dayEntries[0];
        return {
          id: member.id,
          name: member.preferred_name || member.full_name,
          avatarUrl: member.avatar_url,
          location: entry?.location ?? null,
          otherLocation: entry?.other_location ?? null,
          confirmed: entry?.confirmed ?? false,
        };
      })
      .sort((a, b) => {
        // Sort: in-office first, then by name
        const aOffice = a.location?.includes("office") ? 0 : 1;
        const bOffice = b.location?.includes("office") ? 0 : 1;
        if (aOffice !== bOffice) return aOffice - bOffice;
        return a.name.localeCompare(b.name);
      });
  }, [filteredMembers, selectedDate]);

  if (initialMembers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No team members"
        description="Direct reports will appear here once assigned."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter header */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter by team member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Members ({members.length})</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.preferred_name || m.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Month calendar + optional day detail */}
      <div className="flex flex-col lg:flex-row gap-0 rounded-md border overflow-hidden">
        <div className="flex-1 min-w-0 p-4">
          <PeopleCalendar
            workingLocations={allEntries}
            leaveRequests={teamLeaveRequests}
            showEmployee
            mode="team"
            onDayClick={handleDayClick}
            selectedDate={selectedDate}
            onMonthChange={handleMonthChange}
          />
        </div>

        {/* Day detail sidebar — shows who's where */}
        {selectedDate && (
          <div className="border-l bg-background w-full lg:w-80 flex-shrink-0 overflow-y-auto">
            <div className="px-4 py-3 border-b">
              <h4 className="text-sm font-semibold">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </h4>
              <p className="text-xs text-muted-foreground">
                {selectedDayMembers.filter((m) => m.location).length}/{selectedDayMembers.length} with location set
              </p>
            </div>

            <div className="px-4 py-3 space-y-2">
              {selectedDayMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team data for this day</p>
              ) : (
                selectedDayMembers.map((member) => {
                  const locConfig = member.location ? LOCATION_CONFIG[member.location] : null;
                  return (
                    <div key={member.id} className="flex items-center gap-2 py-1">
                      {member.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="h-7 w-7 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0">
                          {getInitials(member.name)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{member.name}</p>
                      </div>
                      {member.location ? (
                        <span className={`text-xs font-medium ${locConfig?.textClass ?? "text-gray-500"}`}>
                          {getLocationLabel(member.location, member.otherLocation)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not set</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
