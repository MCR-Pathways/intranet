"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Building2, Home, Split, CheckCircle2 } from "lucide-react";
import { getTeamSchedule } from "@/app/(protected)/sign-in/actions";
import { LOCATION_CONFIG, getLocationLabel } from "@/lib/sign-in";
import type { TeamMemberSchedule } from "@/lib/sign-in";
import { sanitiseCSVCell, buildCSVContent, downloadCSV } from "@/lib/csv";
import { toast } from "sonner";

// =============================================
// STATS
// =============================================

interface ReportStats {
  officeDays: number;
  homeDays: number;
  splitDays: number;
  confirmationRate: number;
}

function computeStats(members: TeamMemberSchedule[]): ReportStats {
  let officeDays = 0;
  let homeDays = 0;
  let splitDays = 0;
  let officeTotal = 0;
  let officeConfirmed = 0;

  // Track split days by user+date
  const daySlots = new Map<string, Set<string>>();

  for (const member of members) {
    for (const entry of member.entries) {
      const key = `${member.id}|${entry.date}`;
      const slots = daySlots.get(key) ?? new Set<string>();
      slots.add(entry.time_slot);
      daySlots.set(key, slots);

      if (entry.time_slot === "full_day") {
        if (entry.location === "glasgow_office" || entry.location === "stevenage_office") {
          officeDays++;
          officeTotal++;
          if (entry.confirmed) officeConfirmed++;
        } else if (entry.location === "home") {
          homeDays++;
        }
      } else {
        // Half-day counts as 0.5
        if (entry.location === "glasgow_office" || entry.location === "stevenage_office") {
          officeDays += 0.5;
          officeTotal++;
          if (entry.confirmed) officeConfirmed++;
        } else if (entry.location === "home") {
          homeDays += 0.5;
        }
      }
    }
  }

  // Count split days (days with both morning and afternoon entries for same user)
  for (const slots of daySlots.values()) {
    if (slots.has("morning") && slots.has("afternoon")) {
      splitDays++;
    }
  }

  return {
    officeDays: Math.round(officeDays * 10) / 10,
    homeDays: Math.round(homeDays * 10) / 10,
    splitDays,
    confirmationRate: officeTotal > 0 ? Math.round((officeConfirmed / officeTotal) * 100) : 0,
  };
}

// =============================================
// CSV EXPORT
// =============================================

function exportLocationCSV(members: TeamMemberSchedule[], startDate: string, endDate: string) {
  const headers = ["Name", "Date", "Time Slot", "Location", "Other Location", "Source", "Confirmed", "Confirmed At"];
  const rows: string[][] = [];

  for (const member of members) {
    for (const entry of member.entries) {
      rows.push([
        sanitiseCSVCell(member.full_name),
        entry.date,
        entry.time_slot,
        getLocationLabel(entry.location, entry.other_location),
        sanitiseCSVCell(entry.other_location),
        entry.source,
        entry.confirmed ? "Yes" : "No",
        entry.confirmed_at ?? "",
      ]);
    }
  }

  downloadCSV(buildCSVContent(headers, rows), `working-locations-${startDate}-to-${endDate}.csv`);
}

// =============================================
// COMPONENT
// =============================================

interface ReportsPanelProps {
  initialMembers: TeamMemberSchedule[];
}

export function ReportsPanel({ initialMembers }: ReportsPanelProps) {
  const [dateRange, setDateRange] = useState(() => {
    // Default to current week (Mon–Fri)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    return {
      start: monday.toISOString().split("T")[0],
      end: friday.toISOString().split("T")[0],
    };
  });
  const [members, setMembers] = useState(initialMembers);
  const [isPending, startTransition] = useTransition();

  const stats = useMemo(() => computeStats(members), [members]);

  const handleDateChange = (start: string, end: string) => {
    setDateRange({ start, end });
    startTransition(async () => {
      const result = await getTeamSchedule(start, end);
      if (result.error) {
        toast.error(result.error);
      } else {
        setMembers(result.members as TeamMemberSchedule[]);
      }
    });
  };

  const handleExport = () => {
    if (members.length === 0 || members.every((m) => m.entries.length === 0)) {
      toast.error("No data to export");
      return;
    }
    exportLocationCSV(members, dateRange.start, dateRange.end);
    toast.success("CSV exported");
  };

  const statCards = [
    {
      label: "Office Days",
      value: stats.officeDays,
      icon: Building2,
      colour: "text-blue-700",
    },
    {
      label: "Home Days",
      value: stats.homeDays,
      icon: Home,
      colour: "text-emerald-700",
    },
    {
      label: "Split Days",
      value: stats.splitDays,
      icon: Split,
      colour: "text-violet-700",
    },
    {
      label: "Confirmation Rate",
      value: `${stats.confirmationRate}%`,
      icon: CheckCircle2,
      colour: "text-emerald-700",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header with date controls + export */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="report-start" className="text-sm text-muted-foreground">
            From
          </label>
          <input
            id="report-start"
            type="date"
            value={dateRange.start}
            onChange={(e) => handleDateChange(e.target.value, dateRange.end)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
          <label htmlFor="report-end" className="text-sm text-muted-foreground">
            to
          </label>
          <input
            id="report-end"
            type="date"
            value={dateRange.end}
            onChange={(e) => handleDateChange(dateRange.start, e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={handleExport}
          disabled={isPending}
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} className="transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.colour}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.colour}`}>
                {isPending ? "..." : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Location breakdown table */}
      {members.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Team Location Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                      Name
                    </th>
                    {Object.entries(LOCATION_CONFIG).map(([key, config]) => (
                      <th
                        key={key}
                        className="text-centre px-3 py-3 font-medium text-muted-foreground"
                      >
                        {config.shortLabel}
                      </th>
                    ))}
                    <th className="text-centre px-3 py-3 font-medium text-muted-foreground">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const counts: Record<string, number> = {};
                    let total = 0;
                    for (const entry of member.entries) {
                      const dayValue = entry.time_slot === "full_day" ? 1 : 0.5;
                      counts[entry.location] = (counts[entry.location] ?? 0) + dayValue;
                      total += dayValue;
                    }
                    return (
                      <tr key={member.id} className="border-b">
                        <td className="px-4 py-2.5 font-medium">
                          {member.preferred_name ?? member.full_name}
                        </td>
                        {Object.keys(LOCATION_CONFIG).map((key) => (
                          <td key={key} className="text-centre px-3 py-2.5">
                            {counts[key] ? (
                              <span className={LOCATION_CONFIG[key].textClass}>
                                {counts[key]}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        ))}
                        <td className="text-centre px-3 py-2.5 font-medium">
                          {total || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
