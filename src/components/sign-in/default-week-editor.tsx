"use client";

import { useState, useTransition, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LOCATIONS, LOCATION_CONFIG, NOT_SET_CONFIG } from "@/lib/sign-in";
import type { WeeklyPatternEntry } from "@/lib/sign-in";
import type { WorkLocation, TimeSlot } from "@/types/database.types";
import {
  saveWeeklyPattern,
  clearWeeklyPattern,
  applyPatternsToWeek,
} from "@/app/(protected)/sign-in/actions";
import { getWeekDates } from "@/lib/sign-in";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Repeat, Pencil, X, Copy } from "lucide-react";
import { toast } from "sonner";

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon–Fri

interface DefaultWeekEditorProps {
  initialPatterns: WeeklyPatternEntry[];
  onPatternsApplied?: () => void;
}

export function DefaultWeekEditor({
  initialPatterns,
  onPatternsApplied,
}: DefaultWeekEditorProps) {
  const [patterns, setPatterns] = useState<WeeklyPatternEntry[]>(initialPatterns);
  const [editing, setEditing] = useState(false);
  const [editPatterns, setEditPatterns] = useState<
    Map<number, { location: WorkLocation; other_location: string | null }>
  >(new Map());
  const [otherTexts, setOtherTexts] = useState<Map<number, string>>(new Map());
  const [isPending, startTransition] = useTransition();

  const hasPatterns = patterns.length > 0;

  // Build a map: dayOfWeek → pattern for quick lookup
  const patternMap = useMemo(() => {
    const map = new Map<number, WeeklyPatternEntry>();
    for (const p of patterns) {
      // Only full_day for now (plan mentions split-day but compact editor uses full_day)
      if (p.time_slot === "full_day") {
        map.set(p.day_of_week, p);
      }
    }
    return map;
  }, [patterns]);

  const startEditing = () => {
    // Initialise edit state from existing patterns
    const editMap = new Map<number, { location: WorkLocation; other_location: string | null }>();
    const otherMap = new Map<number, string>();
    for (const [day, pattern] of patternMap) {
      editMap.set(day, { location: pattern.location, other_location: pattern.other_location });
      if (pattern.location === "other" && pattern.other_location) {
        otherMap.set(day, pattern.other_location);
      }
    }
    setEditPatterns(editMap);
    setOtherTexts(otherMap);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditPatterns(new Map());
    setOtherTexts(new Map());
  };

  const setLocationForDay = (day: number, value: string) => {
    const newMap = new Map(editPatterns);
    if (value === "__none__") {
      newMap.delete(day);
    } else {
      const location = value as WorkLocation;
      newMap.set(day, {
        location,
        other_location: location === "other" ? (otherTexts.get(day) ?? null) : null,
      });
    }
    setEditPatterns(newMap);
  };

  const copyToAll = (sourceDay: number) => {
    const source = editPatterns.get(sourceDay);
    if (!source) return;
    const newMap = new Map(editPatterns);
    const newOtherTexts = new Map(otherTexts);
    for (const day of WEEKDAYS) {
      if (day === sourceDay) continue;
      newMap.set(day, { ...source });
      if (source.location === "other") {
        newOtherTexts.set(day, otherTexts.get(sourceDay) ?? "");
      } else {
        newOtherTexts.delete(day);
      }
    }
    setEditPatterns(newMap);
    setOtherTexts(newOtherTexts);
  };

  const handleSave = () => {
    // Validate "other" locations have text
    for (const [day, entry] of editPatterns) {
      if (entry.location === "other" && !(otherTexts.get(day)?.trim())) {
        toast.error(`Please specify the "Other" location for ${DAY_NAMES_SHORT[day]}`);
        return;
      }
    }

    startTransition(async () => {
      // Determine which days to save, which to clear
      const existingDays = new Set(patternMap.keys());
      const newDays = new Set(editPatterns.keys());

      // Build all operations and run in parallel
      const clearOps = [...existingDays]
        .filter((day) => !newDays.has(day))
        .map((day) => clearWeeklyPattern(day, "full_day" as TimeSlot));

      const saveOps = [...editPatterns.entries()].map(([day, entry]) => {
        const otherLocation = entry.location === "other" ? otherTexts.get(day)?.trim() : undefined;
        return saveWeeklyPattern(day, "full_day" as TimeSlot, entry.location, otherLocation);
      });

      const results = await Promise.all([...clearOps, ...saveOps]);
      const failed = results.find((r) => !r.success);
      if (failed) {
        toast.error(failed.error ?? "Failed to save patterns");
        return;
      }

      // Update local state
      const newPatterns: WeeklyPatternEntry[] = [];
      for (const [day, entry] of editPatterns) {
        newPatterns.push({
          id: patternMap.get(day)?.id ?? `new-${day}`,
          user_id: patternMap.get(day)?.user_id ?? "",
          day_of_week: day,
          time_slot: "full_day",
          location: entry.location,
          other_location: entry.location === "other" ? (otherTexts.get(day)?.trim() ?? null) : null,
        });
      }
      setPatterns(newPatterns);
      setEditing(false);
      toast.success("Default week saved");
    });
  };

  const handleApply = (weekOffset: number) => {
    const weekDates = getWeekDates(weekOffset);
    const weekStart = weekDates[0];
    const label = weekOffset === 0 ? "this week" : "next week";

    startTransition(async () => {
      const result = await applyPatternsToWeek(weekStart);
      if (!result.success) {
        toast.error(result.error ?? "Failed to apply patterns");
        return;
      }
      toast.success(
        result.applied > 0
          ? `Applied defaults to ${result.applied} day${result.applied !== 1 ? "s" : ""} for ${label}`
          : `No gaps to fill for ${label}`
      );
      onPatternsApplied?.();
    });
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            My Default Week
          </CardTitle>
          {!editing ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={startEditing}
              type="button"
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelEditing}
              type="button"
              disabled={isPending}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {!editing ? (
          /* Collapsed view: compact inline pills */
          hasPatterns ? (
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const pattern = patternMap.get(day);
                const config = pattern
                  ? LOCATION_CONFIG[pattern.location] ?? NOT_SET_CONFIG
                  : NOT_SET_CONFIG;
                const isEmpty = !pattern;

                return (
                  <div
                    key={day}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                      isEmpty
                        ? "bg-gray-50 text-gray-400"
                        : `${config.bgClass} ${config.textClass}`
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {DAY_NAMES_SHORT[day]}
                    </span>
                    <config.icon className="h-3 w-3" />
                    <span>
                      {isEmpty
                        ? "—"
                        : pattern?.location === "other" && pattern.other_location
                          ? pattern.other_location
                          : config.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No default week set. Click Edit to set your typical working week.
            </p>
          )
        ) : (
          /* Expanded/edit view — Google Calendar-style vertical rows */
          <div className="space-y-4">
            {/* Day rows */}
            <div className="space-y-2">
              {WEEKDAYS.map((day, index) => {
                const entry = editPatterns.get(day);
                const config = entry
                  ? LOCATION_CONFIG[entry.location] ?? NOT_SET_CONFIG
                  : NOT_SET_CONFIG;
                const isEmpty = !entry;

                return (
                  <div key={day} className="flex items-center gap-3">
                    {/* Day label */}
                    <span className="text-sm font-medium text-muted-foreground w-24 shrink-0">
                      {DAY_NAMES_FULL[day]}
                    </span>

                    {/* Location dropdown */}
                    <Select
                      value={isEmpty ? "__none__" : entry.location}
                      onValueChange={(value) => setLocationForDay(day, value)}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-9 w-48 text-xs",
                          isEmpty
                            ? "border-dashed border-gray-300 text-gray-400"
                            : `${config.bgClass} ${config.textClass} border-transparent`
                        )}
                      >
                        <SelectValue placeholder="Not set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not set</SelectItem>
                        {LOCATIONS.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            <span className="flex items-center gap-2">
                              <loc.icon className="h-3.5 w-3.5" />
                              {loc.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* "Other" inline text input */}
                    {entry?.location === "other" && (
                      <Input
                        placeholder="Where are you working?"
                        value={otherTexts.get(day) ?? ""}
                        onChange={(e) => {
                          const newMap = new Map(otherTexts);
                          newMap.set(day, e.target.value);
                          setOtherTexts(newMap);
                        }}
                        maxLength={200}
                        className="h-9 flex-1 text-xs"
                      />
                    )}

                    {/* Copy to all — shown on first row only */}
                    {index === 0 && !isEmpty && (
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => copyToAll(day)}
                        className="text-muted-foreground shrink-0"
                      >
                        <Copy />
                        Copy to all
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {hasPatterns && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => handleApply(0)}
                    disabled={isPending}
                  >
                    Apply to this week
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => handleApply(1)}
                    disabled={isPending}
                  >
                    Apply to next week
                  </Button>
                </>
              )}
              <div className="flex-1" />
              <Button
                size="sm"
                type="button"
                onClick={handleSave}
                disabled={isPending}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
