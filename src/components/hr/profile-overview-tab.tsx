"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn, getInitials, getAvatarColour, filterAvatarUrl } from "@/lib/utils";
import {
  formatFTE,
  formatHRDate,
  calculateLengthOfService,
  CONTRACT_TYPE_CONFIG,
  DEPARTMENT_CONFIG,
  REGION_CONFIG,
  WORK_PATTERN_CONFIG,
  type ContractType,
  type Department,
  type Region,
  type WorkPattern,
} from "@/lib/hr";
import {
  Building2,
  MapPin,
  Clock,
  Briefcase,
  CalendarDays,
  Timer,
  Users,
  Shield,
  Check,
  X,
} from "lucide-react";

interface ProfileOverviewTabProps {
  profile: {
    full_name: string;
    preferred_name: string | null;
    email: string;
    avatar_url: string | null;
    job_title: string | null;
    department: Department | null;
    region: Region | null;
    fte: number;
    contract_type: ContractType | null;
    work_pattern: WorkPattern | null;
    start_date: string | null;
    is_external: boolean;
    is_hr_admin: boolean;
    is_ld_admin: boolean;
    is_systems_admin: boolean;
    is_line_manager: boolean;
  };
  /** Optional: resolved line manager name for display */
  lineManagerName?: string | null;
  /** Optional: resolved team name for display */
  teamName?: string | null;
  /** Whether the viewer is an admin — controls visibility of permission badges and card */
  isViewerAdmin?: boolean;
}

/** Reusable detail item row for the overview grid. */
function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || "—"}</p>
      </div>
    </div>
  );
}

export function ProfileOverviewTab({
  profile,
  lineManagerName,
  teamName,
  isViewerAdmin = false,
}: ProfileOverviewTabProps) {
  const departmentLabel = profile.department
    ? DEPARTMENT_CONFIG[profile.department]?.label ?? profile.department
    : null;
  const regionLabel = profile.region
    ? REGION_CONFIG[profile.region]?.label ?? profile.region
    : null;
  const contractLabel = profile.contract_type
    ? CONTRACT_TYPE_CONFIG[profile.contract_type]?.label ?? profile.contract_type
    : null;
  const workPatternLabel = profile.work_pattern
    ? WORK_PATTERN_CONFIG[profile.work_pattern]?.label ?? profile.work_pattern
    : null;

  return (
    <div className="space-y-6">
      {/* Profile header card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={filterAvatarUrl(profile.avatar_url)} alt={profile.full_name} />
              <AvatarFallback className={cn(getAvatarColour(profile.full_name).bg, getAvatarColour(profile.full_name).fg, "text-lg")}>
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">{profile.full_name}</h2>
              {profile.preferred_name && (
                <p className="text-sm text-muted-foreground">
                  Goes by &ldquo;{profile.preferred_name}&rdquo;
                </p>
              )}
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              {profile.job_title && (
                <p className="text-sm font-medium">{profile.job_title}</p>
              )}
              {isViewerAdmin && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {profile.is_hr_admin && <Badge variant="default">HR Admin</Badge>}
                  {profile.is_ld_admin && <Badge variant="secondary">L&D Admin</Badge>}
                  {profile.is_systems_admin && <Badge variant="secondary">Systems Admin</Badge>}
                  {profile.is_line_manager && <Badge variant="outline">Line Manager</Badge>}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employment details grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Employment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailItem
              icon={Building2}
              label="Department"
              value={departmentLabel}
            />
            <Separator />
            <DetailItem
              icon={MapPin}
              label="Region"
              value={regionLabel}
            />
            <Separator />
            <DetailItem
              icon={Briefcase}
              label="Contract Type"
              value={contractLabel}
            />
            <Separator />
            <DetailItem
              icon={Clock}
              label="Work Pattern"
              value={workPatternLabel}
            />
            <Separator />
            <DetailItem
              icon={Users}
              label="FTE"
              value={formatFTE(profile.fte)}
            />
            <Separator />
            <DetailItem
              icon={Briefcase}
              label="Classification"
              value={profile.is_external ? "External" : "Internal"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Dates & Reporting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailItem
              icon={CalendarDays}
              label="Start Date"
              value={formatHRDate(profile.start_date)}
            />
            <Separator />
            <DetailItem
              icon={Timer}
              label="Length of Service"
              value={
                profile.start_date
                  ? calculateLengthOfService(profile.start_date)
                  : "—"
              }
            />
            {lineManagerName !== undefined && (
              <>
                <Separator />
                <DetailItem
                  icon={Users}
                  label="Line Manager"
                  value={lineManagerName}
                />
              </>
            )}
            {teamName !== undefined && (
              <>
                <Separator />
                <DetailItem
                  icon={Building2}
                  label="Team"
                  value={teamName}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Permissions card — only visible to admin viewers */}
      {isViewerAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">System Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <PermissionItem label="HR Admin" granted={profile.is_hr_admin} />
              <PermissionItem label="L&D Admin" granted={profile.is_ld_admin} />
              <PermissionItem label="Systems Admin" granted={profile.is_systems_admin} />
              <PermissionItem label="Line Manager" granted={profile.is_line_manager} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Permission indicator with check/cross icon. */
function PermissionItem({ label, granted }: { label: string; granted: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {granted ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={`text-sm ${granted ? "font-medium" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}
