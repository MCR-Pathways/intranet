"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamMemberCard } from "@/components/hr/team-member-card";
import type { TeamMember, LeaveInfo } from "@/components/hr/team-member-card";
import { LEAVE_TYPE_CONFIG, formatHRDate } from "@/lib/hr";
import type { LeaveType } from "@/lib/hr";
import { getInitials } from "@/lib/utils";
import { Users, Info } from "lucide-react";

// =============================================
// TYPES
// =============================================

interface ManagerInfo {
  id: string;
  full_name: string;
  avatar_url: string | null;
  job_title: string | null;
}

interface TeamPeerContentProps {
  peers: TeamMember[];
  manager: ManagerInfo | null;
  onLeaveMap: Record<string, LeaveInfo>;
}

// =============================================
// COMPONENT
// =============================================

export function TeamPeerContent({
  peers,
  manager,
  onLeaveMap,
}: TeamPeerContentProps) {
  const onLeaveToday = Object.entries(onLeaveMap);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Team"
        subtitle="Your team members"
      />

      {/* Manager info card */}
      {manager && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Line Manager
          </h3>
          <Card className="max-w-sm">
            <CardContent className="flex items-center gap-3 py-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={manager.avatar_url ?? undefined} alt={manager.full_name} />
                <AvatarFallback>{getInitials(manager.full_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{manager.full_name}</p>
                {manager.job_title && (
                  <p className="text-xs text-muted-foreground truncate">{manager.job_title}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Who's off banner */}
      {onLeaveToday.length > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-700">
            {onLeaveToday.map(([profileId, info], i) => {
              const peer = peers.find((p) => p.id === profileId);
              if (!peer) return null;
              const firstName = peer.preferred_name ?? peer.full_name.split(" ")[0];
              const leaveLabel = (LEAVE_TYPE_CONFIG[info.leave_type as LeaveType]?.label ?? "leave").toLowerCase();
              return (
                <span key={profileId}>
                  {i > 0 && ". "}
                  <span className="font-medium">{firstName}</span> is on {leaveLabel} until {formatHRDate(info.end_date)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Peer cards */}
      {peers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members"
          description="You're the only person in your team."
        />
      ) : (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Team Members ({peers.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {peers.map((peer) => (
              <TeamMemberCard
                key={peer.id}
                member={peer}
                leaveInfo={onLeaveMap[peer.id]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
