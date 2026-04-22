"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Calendar, CheckCircle2 } from "lucide-react";
import { cn, formatShortDate } from "@/lib/utils";
import { triggerCalendarSync } from "@/app/(protected)/sign-in/actions";
import { toast } from "sonner";

interface CalendarSyncStatusProps {
  connected: boolean;
  lastSynced: string | null;
  calendarConfigured: boolean;
}

export function CalendarSyncStatus({
  connected,
  lastSynced,
  calendarConfigured,
}: CalendarSyncStatusProps) {
  const [isPending, startTransition] = useTransition();
  const [syncState, setSyncState] = useState<{
    connected: boolean;
    lastSynced: string | null;
  }>({ connected, lastSynced });

  // Don't render anything if calendar sync isn't configured on the server
  if (!calendarConfigured) return null;

  const handleSync = () => {
    startTransition(async () => {
      const result = await triggerCalendarSync();
      if (result.success) {
        setSyncState({ connected: true, lastSynced: new Date().toISOString() });
        toast.success(
          result.upserted! > 0 || result.deleted! > 0
            ? `Synced: ${result.upserted} updated, ${result.deleted} removed`
            : "Calendar is up to date"
        );
      } else {
        toast.error(result.error ?? "Sync failed");
      }
    });
  };

  const formatLastSynced = (iso: string | null): string => {
    if (!iso) return "Never";
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return formatShortDate(date);
  };

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {syncState.connected ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Calendar className="h-3.5 w-3.5" />
      )}
      <span>
        {syncState.connected ? "Calendar synced" : "Calendar not synced"}
        {syncState.lastSynced && (
          <span className="text-muted-foreground/60">
            {" "}
            · {formatLastSynced(syncState.lastSynced)}
          </span>
        )}
      </span>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={handleSync}
        disabled={isPending}
        aria-busy={isPending}
      >
        <RefreshCw className={cn(isPending && "animate-spin")} />
        {isPending ? "Syncing..." : "Sync"}
      </Button>
    </div>
  );
}
