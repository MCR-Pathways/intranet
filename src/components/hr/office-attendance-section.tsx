"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Users, CheckCircle2, Calendar, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

interface DayHeadcount {
  date: string;
  scheduled: number;
  confirmed: number;
  belowTarget: boolean;
  members: { userId: string; fullName?: string; source: string; confirmed: boolean }[];
}

interface OfficeAttendanceSectionProps {
  today: DayHeadcount | null;
  tomorrow: DayHeadcount | null;
  weekDays: DayHeadcount[];
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
}

function StatCard({
  icon: Icon,
  value,
  label,
  sublabel,
  iconColour,
  valueColour,
  alert,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  sublabel: string;
  iconColour: string;
  valueColour: string;
  alert?: boolean;
}) {
  return (
    <Card className={cn("h-full", alert && "border-amber-300 bg-amber-50/50")}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={cn("h-4 w-4", iconColour)} />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", valueColour)}>{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
      </CardContent>
    </Card>
  );
}

export function OfficeAttendanceSection({
  today,
  tomorrow,
  weekDays,
}: OfficeAttendanceSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const todayScheduled = today?.scheduled ?? 0;
  const todayConfirmed = today?.confirmed ?? 0;
  const tomorrowScheduled = tomorrow?.scheduled ?? 0;
  const tomorrowBelowTarget = tomorrow?.belowTarget ?? false;

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Glasgow Office Attendance
      </h2>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
        <StatCard
          icon={Users}
          value={todayScheduled}
          label="Scheduled Today"
          sublabel="Glasgow office today"
          iconColour="text-blue-600"
          valueColour="text-blue-700"
        />
        <StatCard
          icon={CheckCircle2}
          value={todayConfirmed}
          label="Confirmed Today"
          sublabel="Checked in today"
          iconColour="text-emerald-600"
          valueColour="text-emerald-700"
        />
        {tomorrow && (
          <StatCard
            icon={Calendar}
            value={tomorrowScheduled}
            label="Tomorrow"
            sublabel={
              tomorrowBelowTarget
                ? `Below target (4)`
                : `On track`
            }
            iconColour={tomorrowBelowTarget ? "text-amber-600" : "text-blue-600"}
            valueColour={tomorrowBelowTarget ? "text-amber-600" : "text-blue-700"}
            alert={tomorrowBelowTarget}
          />
        )}
      </div>

      {/* Expandable week detail */}
      {weekDays.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">This Week Detail</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Expand
                  </>
                )}
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {/* Compact day row */}
            <div className="flex gap-3 overflow-x-auto pb-2">
              {weekDays.map((day) => (
                <div
                  key={day.date}
                  className={cn(
                    "flex flex-col items-center rounded-lg px-3 py-2 min-w-[70px] text-center",
                    day.belowTarget
                      ? "bg-amber-50 border border-amber-200"
                      : "bg-emerald-50 border border-emerald-200"
                  )}
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatDayLabel(day.date)}
                  </span>
                  <span
                    className={cn(
                      "text-lg font-bold",
                      day.belowTarget ? "text-amber-600" : "text-emerald-600"
                    )}
                  >
                    {day.scheduled}
                  </span>
                  {day.belowTarget ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                </div>
              ))}
            </div>

            {/* Expanded detail: show below-target days */}
            {expanded && (
              <div className="mt-4 space-y-3">
                {weekDays
                  .filter((day) => day.belowTarget)
                  .map((day) => (
                    <div
                      key={day.date}
                      className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3"
                    >
                      <p className="text-sm font-medium text-amber-800">
                        {formatDayLabel(day.date)} ({day.scheduled} scheduled — target: 4)
                      </p>
                      {day.members.length > 0 ? (
                        <ul className="mt-1 text-sm text-amber-700">
                          {day.members.map((m) => (
                            <li key={m.userId} className="flex items-center gap-1">
                              &bull; {m.fullName ?? "Unknown"} ({m.source})
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-amber-600">
                          No one scheduled yet
                        </p>
                      )}
                      <p className="mt-1 text-xs text-amber-500">
                        {4 - day.scheduled} more {4 - day.scheduled === 1 ? "person" : "people"} needed
                      </p>
                    </div>
                  ))}
                {weekDays.filter((day) => day.belowTarget).length === 0 && (
                  <p className="text-sm text-emerald-600">
                    All days are at or above the target of 4.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
