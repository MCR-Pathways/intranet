"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Home, Building2, TrendingUp } from "lucide-react";

interface SignInEntry {
  id: string;
  user_id: string;
  sign_in_date: string;
  location: string;
  other_location: string | null;
  signed_in_at: string;
}

interface StatsCardsProps {
  entries: SignInEntry[];
  memberCount: number;
}

export function StatsCards({ entries, memberCount }: StatsCardsProps) {
  const stats = useMemo(() => {
    const total = entries.length;
    const uniqueDates = new Set(entries.map((e) => e.sign_in_date)).size;
    const homeCount = entries.filter((e) => e.location === "home").length;
    const officeCount = entries.filter(
      (e) =>
        e.location === "glasgow_office" || e.location === "stevenage_office"
    ).length;
    const avgPerDay = uniqueDates > 0 ? (total / uniqueDates).toFixed(1) : "0";

    return {
      totalEntries: total,
      uniqueDays: uniqueDates,
      homePercent: total > 0 ? Math.round((homeCount / total) * 100) : 0,
      officePercent: total > 0 ? Math.round((officeCount / total) * 100) : 0,
      avgEntriesPerDay: avgPerDay,
    };
  }, [entries]);

  const cards = [
    {
      label: "Total Days Logged",
      value: stats.uniqueDays.toString(),
      description: `${stats.totalEntries} total entries`,
      icon: Calendar,
    },
    {
      label: "Home Ratio",
      value: `${stats.homePercent}%`,
      description: `Of all entries`,
      icon: Home,
    },
    {
      label: "Office Ratio",
      value: `${stats.officePercent}%`,
      description: `Of all entries`,
      icon: Building2,
    },
    {
      label: "Avg Entries / Day",
      value: stats.avgEntriesPerDay,
      description: `Across ${memberCount} team members`,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <card.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
