"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  completeUserInduction,
  resetUserInduction,
} from "@/app/(protected)/hr/users/actions";
import { ProfileEditDialog } from "./user-edit-dialog";
import type { DepartmentOption } from "./user-edit-dialog";
import { EmploymentEditDialog } from "./employment-edit-dialog";
import { PermissionsEditDialog } from "./permissions-edit-dialog";
import type { PersonOption } from "./person-combobox";
import type { TeamOption } from "./team-combobox";
import type { EmployeeProfile } from "@/types/hr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
import {
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Briefcase,
  Shield,
  CheckCircle,
  RotateCcw,
  GraduationCap,
} from "lucide-react";
import { getInitials } from "@/lib/utils";
import {
  DEPARTMENT_CONFIG,
  REGION_CONFIG,
  type Department,
  type Region,
} from "@/lib/hr";
import { toast } from "sonner";

/** Profile shape returned by the user management query. */
export interface UserTableProfile {
  id: string;
  full_name: string;
  preferred_name: string | null;
  email: string;
  user_type: string;
  status: string;
  is_hr_admin: boolean;
  is_ld_admin: boolean;
  is_systems_admin: boolean;
  is_line_manager: boolean;
  job_title: string | null;
  avatar_url: string | null;
  induction_completed_at: string | null;
  fte: number | null;
  department: string | null;
  region: string | null;
  contract_type: string | null;
  work_pattern: string | null;
  start_date: string | null;
  probation_end_date: string | null;
  contract_end_date: string | null;
  is_external: boolean | null;
  line_manager_id: string | null;
  team_id: string | null;
}

const statusVariants: Record<string, "success" | "destructive" | "warning"> = {
  active: "success",
  inactive: "destructive",
  pending_induction: "warning",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  pending_induction: "Pending Induction",
};

const roleLabels: Record<string, string> = {
  staff: "Staff",
  pathways_coordinator: "Coordinator",
  new_user: "New User",
};

interface UserTableProps {
  profiles: UserTableProfile[];
  currentUserId?: string;
  departments?: DepartmentOption[];
  /** Whether the current user is an HR admin (controls permission toggle visibility) */
  isCurrentUserHRAdmin?: boolean;
  people?: PersonOption[];
  teams?: TeamOption[];
}

export function UserTable({
  profiles,
  currentUserId,
  departments = [],
  isCurrentUserHRAdmin = false,
  people = [],
  teams = [],
}: UserTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Dialog state
  const [editingProfile, setEditingProfile] = useState<UserTableProfile | null>(null);
  const [employmentProfile, setEmploymentProfile] = useState<UserTableProfile | null>(null);
  const [permissionsProfile, setPermissionsProfile] = useState<UserTableProfile | null>(null);
  const [resetTarget, setResetTarget] = useState<UserTableProfile | null>(null);
  const [completeTarget, setCompleteTarget] = useState<UserTableProfile | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      const matchesSearch =
        profile.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || profile.status === statusFilter;
      const matchesDepartment =
        departmentFilter === "all" || profile.department === departmentFilter;
      const matchesType =
        typeFilter === "all" || profile.user_type === typeFilter;
      return matchesSearch && matchesStatus && matchesDepartment && matchesType;
    });
  }, [profiles, searchQuery, statusFilter, departmentFilter, typeFilter]);

  const handleCompleteInduction = () => {
    if (!completeTarget) return;
    startTransition(async () => {
      const result = await completeUserInduction(completeTarget.id);
      if (result.success) {
        toast.success("Induction completed");
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
      }
      setCompleteTarget(null);
    });
  };

  const handleResetInduction = () => {
    if (!resetTarget) return;
    startTransition(async () => {
      const result = await resetUserInduction(resetTarget.id);
      if (result.success) {
        toast.success("Induction reset");
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
      }
      setResetTarget(null);
    });
  };

  /** Convert a UserTableProfile to the shape EmploymentEditDialog expects */
  const toEmployeeProfile = (p: UserTableProfile): EmployeeProfile => ({
    id: p.id,
    full_name: p.full_name,
    preferred_name: p.preferred_name,
    email: p.email,
    avatar_url: p.avatar_url,
    job_title: p.job_title,
    user_type: p.user_type as EmployeeProfile["user_type"],
    status: p.status as EmployeeProfile["status"],
    fte: p.fte ?? 1,
    department: (p.department ?? null) as EmployeeProfile["department"],
    region: (p.region ?? null) as EmployeeProfile["region"],
    is_line_manager: p.is_line_manager,
    is_hr_admin: p.is_hr_admin,
    is_ld_admin: p.is_ld_admin,
    is_systems_admin: p.is_systems_admin,
    is_external: p.is_external ?? false,
    phone: null,
    start_date: p.start_date,
    contract_type: (p.contract_type ?? "permanent") as EmployeeProfile["contract_type"],
    contract_end_date: p.contract_end_date,
    probation_end_date: p.probation_end_date,
    work_pattern: (p.work_pattern ?? "standard") as EmployeeProfile["work_pattern"],
    line_manager_id: p.line_manager_id,
    team_id: p.team_id,
    induction_completed_at: p.induction_completed_at,
    last_sign_in_date: null,
    created_at: "",
  });

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending_induction">Pending Induction</SelectItem>
          </SelectContent>
        </Select>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {Object.entries(DEPARTMENT_CONFIG).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="pathways_coordinator">Coordinator</SelectItem>
            <SelectItem value="new_user">New User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Person</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Organisation</th>
                <th className="px-4 py-3 font-medium text-muted-foreground w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((profile) => (
                  <tr
                    key={profile.id}
                    className="group border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    {/* Person column — two lines */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name} />
                          <AvatarFallback className="text-xs">
                            {getInitials(profile.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/hr/users/${profile.id}`}
                              className="font-medium hover:underline truncate"
                            >
                              {profile.full_name}
                            </Link>
                            {profile.is_hr_admin && (
                              <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                            )}
                            {profile.is_ld_admin && (
                              <GraduationCap className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {profile.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Status column — two lines */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <Badge variant={statusVariants[profile.status] || "default"}>
                          {statusLabels[profile.status] || profile.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {roleLabels[profile.user_type] || profile.user_type}
                        </p>
                      </div>
                    </td>

                    {/* Organisation column — two lines */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="text-sm">
                          {profile.department
                            ? DEPARTMENT_CONFIG[profile.department as Department]?.label ?? profile.department
                            : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {profile.region
                            ? REGION_CONFIG[profile.region as Region]?.label ?? profile.region
                            : "—"}
                        </p>
                      </div>
                    </td>

                    {/* Actions column — three-dot menu */}
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions for {profile.full_name}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              window.location.href = `/hr/users/${profile.id}`;
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => setEditingProfile(profile)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setEmploymentProfile(profile)}
                          >
                            <Briefcase className="h-4 w-4" />
                            Edit Employment
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setPermissionsProfile(profile)}
                          >
                            <Shield className="h-4 w-4" />
                            Edit Permissions
                          </DropdownMenuItem>
                          {/* Induction actions — show based on state */}
                          {!profile.induction_completed_at && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => setCompleteTarget(profile)}
                              >
                                <CheckCircle className="h-4 w-4" />
                                Complete Induction
                              </DropdownMenuItem>
                            </>
                          )}
                          {profile.induction_completed_at && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => setResetTarget(profile)}
                              >
                                <RotateCcw className="h-4 w-4" />
                                Reset Induction
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
          {filteredProfiles.length} of {profiles.length} users
        </div>
      </Card>

      {/* Edit Profile Dialog */}
      {editingProfile && (
        <ProfileEditDialog
          profile={editingProfile}
          open={!!editingProfile}
          onOpenChange={(open) => {
            if (!open) setEditingProfile(null);
          }}
        />
      )}

      {/* Employment Edit Dialog */}
      {employmentProfile && (
        <EmploymentEditDialog
          profile={toEmployeeProfile(employmentProfile)}
          departments={departments}
          people={people}
          teams={teams}
          open={!!employmentProfile}
          onOpenChange={(open) => {
            if (!open) setEmploymentProfile(null);
          }}
        />
      )}

      {/* Permissions Edit Dialog */}
      {permissionsProfile && (
        <PermissionsEditDialog
          profileId={permissionsProfile.id}
          profileName={permissionsProfile.full_name}
          currentUserId={currentUserId}
          isHRAdmin={permissionsProfile.is_hr_admin}
          isLDAdmin={permissionsProfile.is_ld_admin}
          isSystemsAdmin={permissionsProfile.is_systems_admin}
          isLineManager={permissionsProfile.is_line_manager}
          open={!!permissionsProfile}
          onOpenChange={(open) => {
            if (!open) setPermissionsProfile(null);
          }}
        />
      )}

      {/* Complete Induction Confirmation */}
      <AlertDialog
        open={!!completeTarget}
        onOpenChange={(open) => {
          if (!open) setCompleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Induction</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark {completeTarget?.full_name}&apos;s induction as
              complete and change their status to active. They will gain full
              access to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogClose>
            <Button
              onClick={handleCompleteInduction}
              disabled={isPending}
            >
              {isPending ? "Completing..." : "Complete Induction"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Induction Confirmation */}
      <AlertDialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Induction</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset {resetTarget?.full_name}&apos;s induction status
              and clear all their completed induction items. They will need to
              redo every item from scratch when they next visit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogClose>
            <Button
              variant="destructive"
              onClick={handleResetInduction}
              disabled={isPending}
            >
              {isPending ? "Resetting..." : "Reset Induction"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
