"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { DEPARTMENT_CONFIG } from "@/lib/hr";
import type { Department } from "@/lib/hr";
import { ChevronDown, ChevronUp, Focus } from "lucide-react";

// =============================================
// TYPES
// =============================================

interface OrgChartPersonCardProps {
  personId: string;
  name: string;
  jobTitle: string;
  department: Department | "";
  avatarUrl: string;
  isExternal: boolean;
  isOnLeave: boolean;
  fte: number;
  directReportCount: number;
  totalReportCount: number;
  isHighlighted: boolean;
  isAncestor: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  onToggleExpand: () => void;
  onFocus: (personId: string) => void;
}

// =============================================
// COMPONENT
// =============================================

export function OrgChartPersonCard({
  personId,
  name,
  jobTitle,
  department,
  avatarUrl,
  isExternal,
  isOnLeave,
  fte,
  directReportCount,
  totalReportCount,
  isHighlighted,
  isAncestor,
  hasChildren,
  isCollapsed,
  onToggleExpand,
  onFocus,
}: OrgChartPersonCardProps) {
  const deptConfig = department ? DEPARTMENT_CONFIG[department] : null;
  const deptColour = deptConfig?.colour ?? "#94a3b8";

  return (
    <foreignObject width={280} height={hasChildren ? 130 : 110} x={-140} y={hasChildren ? -50 : -50}>
      <div className="flex flex-col items-center">
        {/* Main card */}
        <div
          className={cn(
            "group relative flex items-center gap-3 rounded-xl border bg-card px-4 py-3 min-w-[260px] cursor-pointer transition-all duration-200",
            "hover:shadow-lg hover:-translate-y-0.5",
            isExternal && "bg-sky-50/80 border-sky-200",
            isHighlighted && "ring-2 ring-primary ring-offset-2 shadow-lg",
            isAncestor && "opacity-60 border-dashed",
          )}
          style={{ borderLeftWidth: 4, borderLeftColor: deptColour }}
          aria-label={`${name}${jobTitle ? `, ${jobTitle}` : ""}${directReportCount > 0 ? `, ${directReportCount} direct reports` : ""}`}
          onClick={() => {
            if (personId) window.location.href = `/hr/users/${personId}`;
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && personId) {
              e.preventDefault();
              window.location.href = `/hr/users/${personId}`;
            }
          }}
        >
          {/* Avatar with status indicator */}
          <div className="relative shrink-0">
            <Avatar className="h-10 w-10 ring-2 ring-background">
              <AvatarImage src={avatarUrl || undefined} alt={name} />
              <AvatarFallback
                className="text-xs font-medium text-white"
                style={{ backgroundColor: deptColour }}
              >
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
            {isOnLeave && (
              <>
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-500 border-2 border-card"
                  title="On leave"
                />
                <span className="sr-only">On leave</span>
              </>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight truncate">{name}</p>
            {jobTitle && (
              <p className="text-xs text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                {jobTitle}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              {isExternal && (
                <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 leading-none">
                  GCC
                </span>
              )}
              {fte !== 1 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground leading-none">
                  {fte} FTE
                </span>
              )}
              {totalReportCount > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary leading-none">
                  {totalReportCount} {totalReportCount === 1 ? "report" : "reports"}
                </span>
              )}
            </div>
          </div>

          {/* Focus button — appears on hover for managers */}
          {hasChildren && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFocus(personId);
              }}
              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
              title="Focus on this person's team"
              aria-label={`Focus on ${name}'s team`}
            >
              <Focus className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Expand/collapse badge — below card for managers */}
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className={cn(
              "mt-1 flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm transition-all duration-200 hover:shadow-md",
              isCollapsed
                ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                : "bg-background text-muted-foreground border-border hover:bg-muted",
            )}
            aria-label={isCollapsed ? `Expand ${directReportCount} direct reports` : "Collapse team"}
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="h-3 w-3" />
                <span>{directReportCount}</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-3 w-3" />
              </>
            )}
          </button>
        )}
      </div>
    </foreignObject>
  );
}
