"use client";

import { cn } from "@/lib/utils";
import {
  LOCATION_CONFIG,
  NOT_SET_CONFIG,
  formatDayName,
  formatDayMonth,
  isToday,
  isPastDate,
} from "@/lib/sign-in";
import type { DaySchedule } from "@/lib/sign-in";
import { CheckCircle2, Calendar, Repeat } from "lucide-react";

interface DayCellProps {
  schedule: DaySchedule;
  onClick: (date: string, timeSlot: "full_day" | "morning" | "afternoon") => void;
}

function SourceIcon({ source }: { source: string }) {
  if (source === "calendar") return <Calendar className="h-3 w-3 text-muted-foreground/50" />;
  if (source === "pattern") return <Repeat className="h-3 w-3 text-muted-foreground/50" />;
  return null;
}

export function DayCell({ schedule, onClick }: DayCellProps) {
  const { date, fullDay, morning, afternoon } = schedule;
  const today = isToday(date);
  const past = isPastDate(date);
  const isSplitDay = !fullDay && (morning || afternoon);

  // On Leave entries are not clickable
  const isLeave = fullDay?.source === "leave";

  if (isSplitDay) {
    return (
      <div
        className={cn(
          "rounded-xl min-h-[140px] transition-all duration-200 overflow-hidden flex flex-col",
          today && "ring-2 ring-primary shadow-sm",
          past && "opacity-50"
        )}
      >
        {/* Date header */}
        <div className="px-3 pt-3 pb-1 bg-background">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {formatDayName(date)}
          </p>
          <p className={cn("text-sm font-semibold", past ? "text-muted-foreground" : "text-foreground")}>
            {formatDayMonth(date)}
          </p>
        </div>

        {/* Morning half */}
        <SplitHalf
          label="AM"
          entry={morning}
          past={past}
          onClick={() => !past && onClick(date, "morning")}
        />

        <div className="border-t border-dashed border-gray-300" />

        {/* Afternoon half */}
        <SplitHalf
          label="PM"
          entry={afternoon}
          past={past}
          onClick={() => !past && onClick(date, "afternoon")}
        />
      </div>
    );
  }

  // Full day cell
  const config = fullDay ? LOCATION_CONFIG[fullDay.location] ?? NOT_SET_CONFIG : NOT_SET_CONFIG;
  const isEmpty = !fullDay;

  return (
    <button
      type="button"
      onClick={() => !past && !isLeave && onClick(date, "full_day")}
      disabled={past || isLeave}
      className={cn(
        "rounded-xl p-4 min-h-[140px] transition-all duration-200 text-left flex flex-col w-full",
        today && "ring-2 ring-primary shadow-sm",
        past && "opacity-50 cursor-default",
        isLeave && "cursor-default opacity-90",
        isEmpty && !past && "border-2 border-dashed border-gray-200 hover:border-primary/40 hover:bg-gray-100/50 cursor-pointer",
        !isEmpty && !past && !isLeave && "hover:ring-2 hover:ring-primary/30 hover:shadow-sm cursor-pointer",
        isEmpty ? NOT_SET_CONFIG.bgClass : config.bgClass,
        isEmpty ? NOT_SET_CONFIG.textClass : config.textClass
      )}
    >
      {/* Date header */}
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {formatDayName(date)}
      </p>
      <p className={cn("text-sm font-semibold mb-2", past ? "text-muted-foreground" : isEmpty ? "text-foreground" : "")}>
        {formatDayMonth(date)}
      </p>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-1">
        <config.icon className={cn("h-6 w-6", isEmpty && "text-gray-300")} />
        <span className={cn("text-sm font-medium text-center", isEmpty && "text-gray-400")}>
          {isEmpty ? "Tap to set" : config.label === "Other" && fullDay?.other_location ? fullDay.other_location : config.label}
        </span>
      </div>

      {/* Footer indicators */}
      <div className="flex items-center justify-between mt-1">
        <div>
          {fullDay && <SourceIcon source={fullDay.source} />}
        </div>
        <div>
          {fullDay?.confirmed && (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          )}
        </div>
      </div>
    </button>
  );
}

function SplitHalf({
  label,
  entry,
  past,
  onClick,
}: {
  label: string;
  entry: DaySchedule["morning"];
  past: boolean;
  onClick: () => void;
}) {
  const config = entry ? LOCATION_CONFIG[entry.location] ?? NOT_SET_CONFIG : NOT_SET_CONFIG;
  const isEmpty = !entry;
  const isLeave = entry?.source === "leave";

  return (
    <button
      type="button"
      onClick={() => !past && !isLeave && onClick()}
      disabled={past || isLeave}
      className={cn(
        "flex-1 px-3 py-2 flex items-center gap-2 transition-colors w-full text-left",
        isEmpty ? "bg-gray-50 text-gray-400" : `${config.bgClass} ${config.textClass}`,
        !past && !isLeave && !isEmpty && "hover:brightness-95 cursor-pointer",
        !past && !isLeave && isEmpty && "hover:bg-gray-100 cursor-pointer",
        (past || isLeave) && "cursor-default"
      )}
    >
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium w-6">
        {label}
      </span>
      <config.icon className={cn("h-4 w-4", isEmpty && "text-gray-300")} />
      <span className="text-xs font-medium truncate">
        {isEmpty ? "—" : config.label === "Other" && entry?.other_location ? entry.other_location : config.shortLabel}
      </span>
      {entry?.confirmed && <CheckCircle2 className="h-3 w-3 text-emerald-600 ml-auto flex-shrink-0" />}
    </button>
  );
}
