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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { getTeamMemberHistory } from "@/app/(protected)/sign-in/actions";
import { formatSignInDate } from "@/lib/sign-in";
import { LocationBadge } from "./location-badge";
import { getInitials } from "@/lib/utils";
import type { TeamMemberSignIn } from "@/types/database.types";
import type { TeamSignInEntry } from "@/lib/sign-in";

interface MemberDetailProps {
  member: TeamMemberSignIn | null;
  open: boolean;
  onClose: () => void;
}

export function MemberDetail({ member, open, onClose }: MemberDetailProps) {
  const [history, setHistory] = useState<TeamSignInEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!member || !open) return;

    setError(null);
    startTransition(async () => {
      // Fetch only this member's history (not all team members)
      const result = await getTeamMemberHistory(member.id);

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setHistory(result.data);
      }
    });
  }, [member, open]);

  // Group entries by date
  const groupedHistory = useMemo(() => {
    const groups = new Map<string, TeamSignInEntry[]>();

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
        ) : error ? (
          <p className="text-sm text-destructive text-center py-4">
            {error}
          </p>
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
                        {entries.map((entry) => (
                          <LocationBadge
                            key={entry.id}
                            entry={entry}
                            showTime
                            className="text-xs"
                          />
                        ))}
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
