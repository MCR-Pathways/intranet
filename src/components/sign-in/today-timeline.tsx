"use client";

import { useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Home, Building2, Globe, Trash2, Loader2 } from "lucide-react";
import { deleteSignInEntry } from "@/app/(protected)/sign-in/actions";

interface TimelineEntry {
  id: string;
  sign_in_date: string;
  location: string;
  other_location: string | null;
  signed_in_at: string;
}

const locationConfig: Record<
  string,
  { label: string; icon: typeof Home; variant: "default" | "secondary" | "outline" }
> = {
  home: { label: "Home", icon: Home, variant: "secondary" },
  glasgow_office: { label: "Glasgow Office", icon: Building2, variant: "default" },
  stevenage_office: { label: "Stevenage Office", icon: Building2, variant: "default" },
  other: { label: "Other", icon: Globe, variant: "outline" },
};

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TimelineItem({ entry }: { entry: TimelineEntry }) {
  const [isPending, startTransition] = useTransition();
  const config = locationConfig[entry.location] ?? locationConfig.other;
  const Icon = config.icon;
  const label =
    entry.location === "other" && entry.other_location
      ? entry.other_location
      : config.label;

  function handleDelete() {
    startTransition(async () => {
      await deleteSignInEntry(entry.id);
    });
  }

  return (
    <div className="flex items-center gap-3 group">
      {/* Timeline dot and line */}
      <div className="flex flex-col items-center">
        <div className="h-3 w-3 rounded-full bg-primary border-2 border-background ring-2 ring-primary/20" />
      </div>

      {/* Time */}
      <span className="text-sm text-muted-foreground font-mono w-14 shrink-0">
        {formatTime(entry.signed_in_at)}
      </span>

      {/* Location badge */}
      <Badge variant={config.variant} className="gap-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
        disabled={isPending}
        aria-label="Delete entry"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

interface TodayTimelineProps {
  entries: TimelineEntry[];
}

export function TodayTimeline({ entries }: TodayTimelineProps) {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Today
        </CardTitle>
        <CardDescription>{today}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No locations recorded today. Use the form to add your first entry.
          </p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <TimelineItem key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
