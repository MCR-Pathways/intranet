import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { fetchWeeklyRoundupsWithClient } from "../actions";
import { formatShortDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function WeeklyRoundupsPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { roundups } = await fetchWeeklyRoundupsWithClient(supabase);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Weekly Round Ups</h1>
        <p className="text-muted-foreground mt-1">
          Browse past weekly summaries of team activity
        </p>
      </div>

      {roundups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-1">
              No round ups yet
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Weekly round ups are automatically generated every Friday.
              Check back after the first week of activity.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {roundups.map((roundup) => {
            const weekStart = new Date(roundup.week_start);
            const weekEnd = new Date(roundup.week_end);

            return (
              <Link
                key={roundup.id}
                href={`/intranet/weekly-roundup/${roundup.id}`}
              >
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {roundup.title}
                          </p>
                          {roundup.summary && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {roundup.summary}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatShortDate(weekStart)} — {formatShortDate(weekEnd)},{" "}
                            {weekEnd.getFullYear()}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
