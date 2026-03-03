"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamMemberCard } from "@/components/hr/team-member-card";
import type { TeamMember, LeaveInfo } from "@/components/hr/team-member-card";
import { LEAVE_TYPE_CONFIG, formatHRDate } from "@/lib/hr";
import type { LeaveType } from "@/lib/hr";
import { Users, Calendar, Clock, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================
// TYPES
// =============================================

interface TeamDashboardContentProps {
  reports: TeamMember[];
  onLeaveMap: Record<string, LeaveInfo>;
  pendingApprovalCount: number;
  currentUserId: string;
}

// =============================================
// SUMMARY PILL
// =============================================

interface SummaryPillProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  className?: string;
  href?: string;
}

function SummaryPill({ icon: Icon, label, value, className, href }: SummaryPillProps) {
  const content = (
    <div className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-sm", className)}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// =============================================
// COMPONENT
// =============================================

export function TeamDashboardContent({
  reports,
  onLeaveMap,
  pendingApprovalCount,
  currentUserId,
}: TeamDashboardContentProps) {
  const onLeaveToday = Object.entries(onLeaveMap);

  if (reports.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Team"
          subtitle="View your direct reports"
        />
        <EmptyState
          icon={Users}
          title="No direct reports"
          description="You don't have any direct reports assigned to you."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Team"
        subtitle={`${reports.length} direct report${reports.length !== 1 ? "s" : ""}`}
      />

      {/* Summary strip */}
      <div className="flex flex-wrap gap-3">
        <SummaryPill
          icon={Users}
          label="Team size"
          value={reports.length}
        />
        {onLeaveToday.length > 0 && (
          <SummaryPill
            icon={Calendar}
            label="On leave today"
            value={onLeaveToday.length}
            className="border-blue-200 bg-blue-50 text-blue-700"
          />
        )}
        {pendingApprovalCount > 0 && (
          <SummaryPill
            icon={Clock}
            label="Pending approvals"
            value={pendingApprovalCount}
            className="border-amber-200 bg-amber-50 text-amber-700"
            href="/hr/leave?tab=approvals"
          />
        )}
      </div>

      {/* Who's off banner */}
      {onLeaveToday.length > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-700">
            {onLeaveToday.map(([profileId, info], i) => {
              const member = reports.find((r) => r.id === profileId);
              if (!member) return null;
              const firstName = member.preferred_name ?? member.full_name.split(" ")[0];
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

      {/* Card grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((member) => (
          <TeamMemberCard
            key={member.id}
            member={member}
            leaveInfo={onLeaveMap[member.id]}
            showActions
          />
        ))}
      </div>
    </div>
  );
}
