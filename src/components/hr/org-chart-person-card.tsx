"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { DEPARTMENT_CONFIG } from "@/lib/hr";
import type { Department } from "@/lib/hr";

// =============================================
// TYPES
// =============================================

interface OrgChartPersonCardProps {
  name: string;
  jobTitle: string;
  department: Department | "";
  avatarUrl: string;
  isExternal: boolean;
  isOnLeave: boolean;
  fte: number;
  directReportCount: number;
  isHighlighted: boolean;
}

// =============================================
// COMPONENT
// =============================================

export function OrgChartPersonCard({
  name,
  jobTitle,
  department,
  avatarUrl,
  isExternal,
  isOnLeave,
  fte,
  directReportCount,
  isHighlighted,
}: OrgChartPersonCardProps) {
  const deptColour = department
    ? DEPARTMENT_CONFIG[department]?.colour ?? "#94a3b8"
    : "#94a3b8";

  return (
    <foreignObject width={220} height={90} x={-110} y={-40}>
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 shadow-sm min-w-[200px] transition-shadow",
          isExternal && "bg-sky-50 border-sky-200",
          isHighlighted && "ring-2 ring-primary ring-offset-2"
        )}
        style={{ borderLeftWidth: 3, borderLeftColor: deptColour }}
        aria-label={`${name}${jobTitle ? `, ${jobTitle}` : ""}${directReportCount > 0 ? `, ${directReportCount} direct reports` : ""}`}
      >
        {/* Avatar with status indicator */}
        <div className="relative shrink-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatarUrl || undefined} alt={name} />
            <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
          </Avatar>
          {isOnLeave && (
            <>
              <span
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 border-2 border-background"
                title="On leave"
              />
              <span className="sr-only">On leave</span>
            </>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-tight truncate">{name}</p>
          {jobTitle && (
            <p className="text-[10px] text-muted-foreground leading-tight truncate mt-0.5">
              {jobTitle}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            {isExternal && (
              <span className="rounded bg-sky-100 px-1 py-0.5 text-[9px] font-medium text-sky-700 leading-none">
                GCC
              </span>
            )}
            {fte !== 1 && (
              <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground leading-none">
                {fte} FTE
              </span>
            )}
          </div>
        </div>
      </div>
    </foreignObject>
  );
}
