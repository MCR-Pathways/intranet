"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

interface WeeklyRoundupBannerProps {
  roundup: {
    id: string;
    title: string;
    summary: string | null;
    week_start: string;
    week_end: string;
  };
}

export function WeeklyRoundupBanner({ roundup }: WeeklyRoundupBannerProps) {
  return (
    <Link href={`/intranet/weekly-roundup/${roundup.id}`}>
      <Card className="border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{roundup.title}</p>
                  <Badge variant="default" className="text-xs">New</Badge>
                </div>
                {roundup.summary && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {roundup.summary}
                  </p>
                )}
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
