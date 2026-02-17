"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { getTeamSignInHistory } from "@/app/(protected)/sign-in/actions";
import { LOCATION_CONFIG, formatSignInTime, formatSignInDate, getLocationLabel, getInitials } from "@/lib/sign-in";
import type { TeamMemberSignIn } from "@/types/database.types";

interface HistoryEntry {
  id: string;
  user_id: string;
  sign_in_date: string;
  location: string;
  other_location: string | null;
  signed_in_at: string;
}

interface MemberDetailProps {
  member: TeamMemberSignIn | null;
  open: boolean;
  onClose: () => void;
}

export function MemberDetail({ member, open, onClose }: MemberDetailProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!member || !open) return;

    startTransition(async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await getTeamSignInHistory({
        startDate: thirtyDaysAgo.toISOString().split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
      });

      if (!result.error && result.data) {
        // Filter to just this member's entries
        setHistory(result.data.filter((e) => e.user_id === member.id));
      }
    });
  }, [member, open]);

  // Group entries by date
  const groupedHistory = useMemo(() => {
    const groups = new Map<string, HistoryEntry[]>();

    for (const entry of history) {
      const existing = groups.get(entry.sign_in_date) ?? [];
      existing.push(entry);
      groups.set(entry.sign_in_date, existing);
    }

    return Array.from(groups.entries()).sort(
      ([a], [b]) => b.localeCompare(a) // descending by date
    );
  }, [history]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = history.length;
    const uniqueDays = new Set(history.map((e) => e.sign_in_date)).size;
    const homeCount = history.filter((e) => e.location === "home").length;
    const officeCount = history.filter(
      (e) =>
        e.location === "glasgow_office" || e.location === "stevenage_office"
    ).length;

    return {
      totalEntries: total,
      uniqueDays,
      homePercent: total > 0 ? Math.round((homeCount / total) * 100) : 0,
      officePercent: total > 0 ? Math.round((officeCount / total) * 100) : 0,
    };
  }, [history]);

  if (!member) return null;

  const displayName = member.preferred_name ?? member.full_name;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={member.avatar_url ?? undefined} />
              <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle>{displayName}</DialogTitle>
              <DialogDescription>{member.job_title}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isPending ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{stats.uniqueDays}</p>
                <p className="text-xs text-muted-foreground">Days logged</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{stats.homePercent}%</p>
                <p className="text-xs text-muted-foreground">Home</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{stats.officePercent}%</p>
                <p className="text-xs text-muted-foreground">Office</p>
              </div>
            </div>

            {/* History */}
            <ScrollArea className="max-h-64">
              <div className="space-y-3">
                {groupedHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No location history in the past 30 days.
                  </p>
                ) : (
                  groupedHistory.map(([date, entries]) => (
                    <div key={date} className="flex items-start gap-3">
                      <span className="text-xs font-medium text-muted-foreground w-20 shrink-0 pt-0.5">
                        {formatSignInDate(date)}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
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
                              <span className="font-mono">
                                {formatSignInTime(entry.signed_in_at)}
                              </span>
                              {label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
