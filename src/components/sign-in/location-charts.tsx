"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

interface SignInEntry {
  id: string;
  user_id: string;
  sign_in_date: string;
  location: string;
  other_location: string | null;
  signed_in_at: string;
}

const locationLabels: Record<string, string> = {
  home: "Home",
  glasgow_office: "Glasgow",
  stevenage_office: "Stevenage",
  other: "Other",
};

const locationColors: Record<string, string> = {
  home: "hsl(var(--chart-1, 220 70% 50%))",
  glasgow_office: "hsl(var(--chart-2, 160 60% 45%))",
  stevenage_office: "hsl(var(--chart-3, 30 80% 55%))",
  other: "hsl(var(--chart-4, 280 65% 60%))",
};

interface LocationChartsProps {
  entries: SignInEntry[];
}

export function LocationCharts({ entries }: LocationChartsProps) {
  // Bar chart data: count per location
  const distributionData = useMemo(() => {
    const counts: Record<string, number> = {
      home: 0,
      glasgow_office: 0,
      stevenage_office: 0,
      other: 0,
    };

    for (const entry of entries) {
      if (counts[entry.location] !== undefined) {
        counts[entry.location]++;
      }
    }

    return Object.entries(counts).map(([location, count]) => ({
      name: locationLabels[location] ?? location,
      count,
      fill: locationColors[location] ?? "hsl(var(--muted-foreground))",
    }));
  }, [entries]);

  // Line chart data: entries per date per location
  const trendData = useMemo(() => {
    const dateMap = new Map<
      string,
      { date: string; home: number; glasgow_office: number; stevenage_office: number; other: number }
    >();

    // Collect all dates
    const allDates = new Set(entries.map((e) => e.sign_in_date));
    const sortedDates = Array.from(allDates).sort();

    for (const date of sortedDates) {
      dateMap.set(date, { date, home: 0, glasgow_office: 0, stevenage_office: 0, other: 0 });
    }

    const locationKeys = ["home", "glasgow_office", "stevenage_office", "other"] as const;
    for (const entry of entries) {
      const row = dateMap.get(entry.sign_in_date);
      if (row && locationKeys.includes(entry.location as typeof locationKeys[number])) {
        row[entry.location as typeof locationKeys[number]]++;
      }
    }

    return Array.from(dateMap.values()).map((row) => ({
      ...row,
      date: new Date(row.date + "T00:00:00").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      }),
    }));
  }, [entries]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Location Distribution Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Location Distribution</CardTitle>
          <CardDescription>Total entries by location</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData}>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" name="Entries" radius={[4, 4, 0, 0]}>
                  {distributionData.map((entry, index) => (
                    <rect key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Trends Over Time Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trends Over Time</CardTitle>
          <CardDescription>Daily entries by location</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="home"
                  name="Home"
                  stroke={locationColors.home}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="glasgow_office"
                  name="Glasgow"
                  stroke={locationColors.glasgow_office}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="stevenage_office"
                  name="Stevenage"
                  stroke={locationColors.stevenage_office}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="other"
                  name="Other"
                  stroke={locationColors.other}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
