"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { LOCATION_CONFIG, formatSignInTime, formatSignInDate, getLocationLabel } from "@/lib/sign-in";

interface HistoryEntry {
  id: string;
  sign_in_date: string;
  location: string;
  other_location: string | null;
  signed_in_at: string;
}

interface MonthlyHistoryProps {
  entries: HistoryEntry[];
}

export function MonthlyHistory({ entries }: MonthlyHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Group entries by date, excluding today
  const groupedByDate = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const groups = new Map<string, HistoryEntry[]>();

    for (const entry of entries) {
      if (entry.sign_in_date === today) continue;
      const existing = groups.get(entry.sign_in_date) ?? [];
      existing.push(entry);
      groups.set(entry.sign_in_date, existing);
    }

    return Array.from(groups.entries()).sort(
      ([a], [b]) => b.localeCompare(a) // descending by date
    );
  }, [entries]);

  if (groupedByDate.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            History
          </CardTitle>
          <CardDescription>Past 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No location history to display yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show first 7 days by default, all 30 when expanded
  const visibleDates = isExpanded ? groupedByDate : groupedByDate.slice(0, 7);
  const hasMore = groupedByDate.length > 7;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          History
        </CardTitle>
        <CardDescription>
          Past 30 days &middot; {groupedByDate.length} day{groupedByDate.length !== 1 ? "s" : ""} recorded
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {visibleDates.map(([date, dateEntries]) => (
          <div key={date} className="flex items-start gap-4">
            <span className="text-sm font-medium text-muted-foreground w-24 shrink-0 pt-0.5">
              {formatSignInDate(date)}
            </span>
            <div className="flex flex-wrap gap-2">
              {dateEntries.map((entry) => {
                const config = LOCATION_CONFIG[entry.location] ?? LOCATION_CONFIG.other;
                const Icon = config.icon;
                const label = getLocationLabel(entry.location, entry.other_location);

                return (
                  <Badge
                    key={entry.id}
                    variant={config.variant}
                    className="gap-1.5"
                  >
                    <Icon className="h-3 w-3" />
                    <span className="font-mono text-xs">
                      {formatSignInTime(entry.signed_in_at)}
                    </span>
                    {label}
                  </Badge>
                );
              })}
            </div>
          </div>
        ))}

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show all {groupedByDate.length} days
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
