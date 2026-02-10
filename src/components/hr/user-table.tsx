"use client";

import { useState, useMemo, useTransition } from "react";
import {
  completeUserInduction,
  resetUserInduction,
} from "@/app/(protected)/hr/users/actions";
import { UserEditDialog } from "./user-edit-dialog";
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
import { Search, Pencil, CheckCircle, RotateCcw, Shield } from "lucide-react";
import type { Profile } from "@/types/database.types";

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
  profiles: Profile[];
}

export function UserTable({ profiles }: UserTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      const matchesSearch =
        profile.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || profile.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [profiles, searchQuery, statusFilter]);

  const handleCompleteInduction = (userId: string) => {
    startTransition(async () => {
      await completeUserInduction(userId);
    });
  };

  const handleResetInduction = () => {
    if (!resetTarget) return;
    startTransition(async () => {
      await resetUserInduction(resetTarget.id);
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
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending_induction">Pending Induction</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Email
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Role
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Induction
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
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
                          <p className="font-medium">{profile.full_name}</p>
                          {profile.preferred_name && (
                            <p className="text-xs text-muted-foreground">
                              ({profile.preferred_name})
                            </p>
                          )}
                        </div>
                        {profile.is_hr_admin && (
                          <Shield className="h-3.5 w-3.5 text-primary" />
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
                            onClick={() =>
                              handleCompleteInduction(profile.id)
                            }
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
          open={!!editingProfile}
          onOpenChange={(open) => {
            if (!open) setEditingProfile(null);
          }}
        />
      )}

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
              This will reset {resetTarget?.full_name}&apos;s induction status.
              They will be redirected to the induction flow on their next visit.
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
