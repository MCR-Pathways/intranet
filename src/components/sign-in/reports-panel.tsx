"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileDown, Loader2, BarChart3, AlertTriangle } from "lucide-react";
import { getTeamSignInHistory } from "@/app/(protected)/sign-in/actions";
import { LOCATION_CONFIG, formatSignInTime, formatSignInDate, getLocationLabel, getInitials } from "@/lib/sign-in";
import dynamic from "next/dynamic";
import { StatsCards } from "./stats-cards";
import { Skeleton } from "@/components/ui/skeleton";

const LocationCharts = dynamic(() => import("./location-charts").then((m) => m.LocationCharts), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <Skeleton className="h-[300px] w-full rounded-lg" />
      <Skeleton className="h-[300px] w-full rounded-lg" />
    </div>
  ),
});

interface SignInEntry {
  id: string;
  user_id: string;
  sign_in_date: string;
  location: string;
  other_location: string | null;
  signed_in_at: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  preferred_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
}

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export function ReportsPanel() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [signIns, setSignIns] = useState<SignInEntry[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerateReport() {
    startTransition(async () => {
      setError(null);
      const result = await getTeamSignInHistory({
        startDate,
        endDate,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSignIns(result.data);
        setMembers(result.members);
        setTruncated(result.truncated ?? false);
        setHasLoaded(true);
      }
    });
  }

  // Group sign-ins by member
  const memberBreakdown = useMemo(() => {
    const map = new Map<string, SignInEntry[]>();
    for (const entry of signIns) {
      const existing = map.get(entry.user_id) ?? [];
      existing.push(entry);
      map.set(entry.user_id, existing);
    }

    return members.map((member) => ({
      member,
      entries: map.get(member.id) ?? [],
    }));
  }, [signIns, members]);

  function exportCSV() {
    const headers = ["Name", "Date", "Time", "Location", "Other Location"];
    const rows = signIns.map((entry) => {
      const member = members.find((m) => m.id === entry.user_id);
      const name = member
        ? member.preferred_name ?? member.full_name
        : "Unknown";
      const loc =
        LOCATION_CONFIG[entry.location]?.label ?? entry.location;
      return [
        name,
        entry.sign_in_date,
        formatSignInTime(entry.signed_in_at),
        loc,
        entry.other_location ?? "",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `team-sign-ins-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Date range filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Generate Report
          </CardTitle>
          <CardDescription>
            Select a date range to generate team location reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-44"
              />
            </div>
            <Button onClick={handleGenerateReport} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                "Generate Report"
              )}
            </Button>
            {hasLoaded && signIns.length > 0 && (
              <Button variant="outline" onClick={exportCSV}>
                <FileDown className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
          {error && (
            <p className="text-sm text-destructive mt-3">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Truncation warning */}
      {truncated && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Results were limited to 1,000 entries. Try a shorter date range for complete data.
          </span>
        </div>
      )}

      {/* Results */}
      {hasLoaded && (
        <>
          {signIns.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No sign-in data found for the selected date range.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Stats cards */}
              <StatsCards entries={signIns} memberCount={members.length} />

              {/* Charts */}
              <LocationCharts entries={signIns} />

              {/* Per-member breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Team Member Breakdown</CardTitle>
                  <CardDescription>
                    Individual location records for the selected period
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {memberBreakdown.map(({ member, entries }) => {
                    const displayName =
                      member.preferred_name ?? member.full_name;

                    return (
                      <div key={member.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage
                              src={member.avatar_url ?? undefined}
                            />
                            <AvatarFallback className="text-xs">
                              {getInitials(displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {displayName}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {entries.length} entries
                          </Badge>
                        </div>

                        {entries.length === 0 ? (
                          <p className="text-xs text-muted-foreground pl-9">
                            No entries in this period
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 pl-9">
                            {entries.map((entry) => {
                              const config =
                                LOCATION_CONFIG[entry.location] ??
                                LOCATION_CONFIG.other;
                              const Icon = config.icon;
                              const label = getLocationLabel(entry.location, entry.other_location);

                              return (
                                <Badge
                                  key={entry.id}
                                  variant={config.variant}
                                  className="gap-1 text-xs"
                                >
                                  <Icon className="h-3 w-3" />
                                  {formatSignInDate(entry.sign_in_date)}
                                  <span className="font-mono">
                                    {formatSignInTime(entry.signed_in_at)}
                                  </span>
                                  {label}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
