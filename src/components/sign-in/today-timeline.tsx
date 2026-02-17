"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, Trash2, Loader2 } from "lucide-react";
import { deleteSignInEntry } from "@/app/(protected)/sign-in/actions";
import { LOCATION_CONFIG, formatSignInTime, getLocationLabel } from "@/lib/sign-in";

interface TimelineEntry {
  id: string;
  sign_in_date: string;
  location: string;
  other_location: string | null;
  signed_in_at: string;
}

function TimelineItem({ entry }: { entry: TimelineEntry }) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const config = LOCATION_CONFIG[entry.location] ?? LOCATION_CONFIG.other;
  const Icon = config.icon;
  const label = getLocationLabel(entry.location, entry.other_location);

  function handleDelete() {
    startTransition(async () => {
      await deleteSignInEntry(entry.id);
      setShowDeleteDialog(false);
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
        {formatSignInTime(entry.signed_in_at)}
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
        onClick={() => setShowDeleteDialog(true)}
        disabled={isPending}
        aria-label="Delete entry"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sign-in entry? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </AlertDialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
