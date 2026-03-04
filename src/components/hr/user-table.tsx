"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  completeUserInduction,
  resetUserInduction,
} from "@/app/(protected)/hr/users/actions";
import { UserEditDialog } from "./user-edit-dialog";
import type { DepartmentOption } from "./user-edit-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Pencil,
  CheckCircle,
  RotateCcw,
  Shield,
  GraduationCap,
} from "lucide-react";
import {
  formatFTE,
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
  pathways_coordinator: "Pathways Coordinator",
  new_user: "New User",
};

interface UserTableProps {
  profiles: UserTableProfile[];
  currentUserId?: string;
  departments?: DepartmentOption[];
}

export function UserTable({ profiles, currentUserId, departments = [] }: UserTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [editingProfile, setEditingProfile] = useState<UserTableProfile | null>(null);
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
      const matchesRegion =
        regionFilter === "all" || profile.region === regionFilter;
      return matchesSearch && matchesStatus && matchesDepartment && matchesRegion;
    });
  }, [profiles, searchQuery, statusFilter, departmentFilter, regionFilter]);

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
        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {Object.entries(REGION_CONFIG).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Department</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Region</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">FTE</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Induction</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((profile) => (
                  <tr
                    key={profile.id}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <Link
                            href={`/hr/users/${profile.id}`}
                            className="font-medium hover:underline"
                          >
                            {profile.full_name}
                          </Link>
                          {profile.preferred_name && (
                            <p className="text-xs text-muted-foreground">
                              ({profile.preferred_name})
                            </p>
                          )}
                        </div>
                        {profile.is_hr_admin && (
                          <Shield className="h-3.5 w-3.5 text-primary" />
                        )}
                        {profile.is_ld_admin && (
                          <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {profile.email}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        {roleLabels[profile.user_type] || profile.user_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariants[profile.status] || "default"}>
                        {statusLabels[profile.status] || profile.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {profile.department
                        ? DEPARTMENT_CONFIG[profile.department as Department]?.label ?? profile.department
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {profile.region
                        ? REGION_CONFIG[profile.region as Region]?.label ?? profile.region
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatFTE(profile.fte)}
                    </td>
                    <td className="px-4 py-3">
                      {profile.induction_completed_at ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(
                              profile.induction_completed_at
                            ).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setResetTarget(profile)}
                            disabled={isPending}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Reset
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="warning">Pending</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-green-600 hover:text-green-700"
                            onClick={() => setCompleteTarget(profile)}
                            disabled={isPending}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setEditingProfile(profile)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
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

      {/* Edit Dialog */}
      {editingProfile && (
        <UserEditDialog
          profile={editingProfile}
          currentUserId={currentUserId}
          departments={departments}
          open={!!editingProfile}
          onOpenChange={(open) => {
            if (!open) setEditingProfile(null);
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
