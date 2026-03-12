"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getInitials, getAvatarColour } from "@/lib/utils";
import { LEAVE_TYPE_CONFIG, WORK_PATTERN_CONFIG, formatHRDate } from "@/lib/hr";
import type { LeaveType, WorkPattern } from "@/lib/hr";
import { MoreHorizontal, User, Calendar, Eye, Cake } from "lucide-react";

// =============================================
// TYPES
// =============================================

export interface TeamMember {
  id: string;
  full_name: string;
  preferred_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  start_date: string | null;
  work_pattern: string | null;
  is_external: boolean;
}

export interface LeaveInfo {
  leave_type: string;
  end_date: string;
}

export interface AnniversaryInfo {
  years: number;
  date: string;
}

// =============================================
// HELPERS
// =============================================

function getDisplayName(member: TeamMember): string {
  if (member.preferred_name && member.preferred_name !== member.full_name.split(" ")[0]) {
    return `${member.full_name} (${member.preferred_name})`;
  }
  return member.full_name;
}

function getTenure(startDate: string | null): string | null {
  if (!startDate) return null;
  const start = new Date(startDate + "T00:00:00");
  const now = new Date();
  const years = now.getFullYear() - start.getFullYear();
  const months = now.getMonth() - start.getMonth();
  const totalMonths = years * 12 + months;

  if (totalMonths < 1) return "Joined this month";
  if (totalMonths < 12) return `Joined ${totalMonths}mo ago`;
  const y = Math.floor(totalMonths / 12);
  return `Joined ${y}y ago`;
}

// =============================================
// COMPONENT
// =============================================

interface TeamMemberCardProps {
  member: TeamMember;
  leaveInfo?: LeaveInfo;
  anniversaryInfo?: AnniversaryInfo;
  showActions?: boolean;
}

export function TeamMemberCard({ member, leaveInfo, anniversaryInfo, showActions = false }: TeamMemberCardProps) {
  const isOnLeave = !!leaveInfo;
  const displayName = getDisplayName(member);
  const tenure = getTenure(member.start_date);
  const workPattern = member.work_pattern as WorkPattern | null;
  const isNonStandard = workPattern && workPattern !== "standard";

  const leaveLabel = isOnLeave
    ? LEAVE_TYPE_CONFIG[leaveInfo.leave_type as LeaveType]?.label ?? "Leave"
    : null;

  return (
    <Card className="relative transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start gap-3 pb-2">
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarImage src={member.avatar_url ?? undefined} alt={member.full_name} />
            <AvatarFallback className={cn(getAvatarColour(member.full_name).bg, getAvatarColour(member.full_name).fg)}>{getInitials(member.full_name)}</AvatarFallback>
          </Avatar>
          {/* Status dot */}
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
              isOnLeave ? "bg-amber-500" : "bg-green-500"
            )}
            title={isOnLeave ? `On ${leaveLabel}` : "Active"}
          />
          <span className="sr-only">
            {isOnLeave ? `On ${leaveLabel}` : "Active"}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate">{displayName}</p>
          {member.job_title && (
            <p className="text-xs text-muted-foreground truncate">{member.job_title}</p>
          )}
          {member.is_external && (
            <span className="inline-block mt-0.5 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
              GCC
            </span>
          )}
        </div>

        {/* Manager action menu */}
        {showActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions for {member.full_name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => { window.location.href = `/hr/users`; }}
              >
                <User className="h-4 w-4 mr-2" />
                View in User Management
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => { window.location.href = `/hr/leave?tab=approvals`; }}
              >
                <Calendar className="h-4 w-4 mr-2" />
                View Leave
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => { window.location.href = `/hr/leave?tab=calendar`; }}
              >
                <Eye className="h-4 w-4 mr-2" />
                View on Calendar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {isOnLeave && (
            <p className="text-amber-700 font-medium">
              {leaveLabel} until {formatHRDate(leaveInfo.end_date)}
            </p>
          )}
          {anniversaryInfo && (
            <p className="text-purple-700 font-medium flex items-center gap-1">
              <Cake className="h-3 w-3 shrink-0" />
              {anniversaryInfo.years} year{anniversaryInfo.years !== 1 ? "s" : ""} on {formatHRDate(anniversaryInfo.date)}
            </p>
          )}
          {isNonStandard && (
            <p>{WORK_PATTERN_CONFIG[workPattern].label}</p>
          )}
          {tenure && <p>{tenure}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
