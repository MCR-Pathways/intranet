"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import {
  assignCourse,
  removeAssignment,
  previewAssignment,
} from "@/app/(protected)/learning/admin/courses/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { PersonCombobox, type PersonOption } from "@/components/hr/person-combobox";
import { toast } from "sonner";
import { Plus, X, Users, UserCheck, User, Loader2 } from "lucide-react";
import type { CourseAssignment, Team } from "@/types/database.types";

const userTypeLabels: Record<string, string> = {
  staff: "All Staff",
};

const externalLabels: Record<string, string> = {
  true: "External Staff Only",
  false: "Internal Staff Only",
};

interface CourseAssignmentManagerProps {
  courseId: string;
  assignments: CourseAssignment[];
  teams: Pick<Team, "id" | "name">[];
  profiles?: PersonOption[];
}

export function CourseAssignmentManager({
  courseId,
  assignments,
  teams,
  profiles = [],
}: CourseAssignmentManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [showDialog, setShowDialog] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<CourseAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [assignType, setAssignType] = useState<string>("user_type");
  const [assignValue, setAssignValue] = useState<string>("");

  // Preview state
  const [preview, setPreview] = useState<{
    loading: boolean;
    matchCount?: number;
    alreadyEnrolled?: number;
    sampleNames?: string[];
  }>({ loading: false });
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch preview when assignType/assignValue changes
  useEffect(() => {
    // Clear previous timer
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }

    // Reset preview if no value selected
    if (!assignValue) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreview({ loading: false });
      return;
    }

    setPreview({ loading: true });

    previewTimerRef.current = setTimeout(async () => {
      const result = await previewAssignment({
        course_id: courseId,
        assign_type: assignType,
        assign_value: assignValue,
      });

      if (result.success) {
        setPreview({
          loading: false,
          matchCount: result.matchCount,
          alreadyEnrolled: result.alreadyEnrolled,
          sampleNames: result.sampleNames,
        });
      } else {
        setPreview({ loading: false });
      }
    }, 500);

    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
    };
  }, [courseId, assignType, assignValue]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!assignValue) {
      setError("Please select a value");
      return;
    }

    startTransition(async () => {
      const result = await assignCourse({
        course_id: courseId,
        assign_type: assignType,
        assign_value: assignValue,
      });

      if (result.success) {
        toast.success("Course assigned");
        setAssignValue("");
        setPreview({ loading: false });
        setShowDialog(false);
      } else {
        setError(result.error || "Failed to assign course");
        toast.error(result.error || "Failed to assign course");
      }
    });
  };

  const handleRemove = (assignment: CourseAssignment) => {
    setRemoveTarget(assignment);
  };

  const handleConfirmRemove = () => {
    if (!removeTarget) return;
    startTransition(async () => {
      await removeAssignment(removeTarget.id, courseId);
      toast.success("Assignment removed");
      setRemoveTarget(null);
    });
  };

  const getAssignmentLabel = (assignment: CourseAssignment) => {
    if (assignment.assign_type === "user_type") {
      return userTypeLabels[assignment.assign_value] || assignment.assign_value;
    }
    if (assignment.assign_type === "is_external") {
      return externalLabels[assignment.assign_value] || assignment.assign_value;
    }
    if (assignment.assign_type === "user") {
      const person = profiles.find((p) => p.id === assignment.assign_value);
      return person?.full_name || "Individual User";
    }
    const team = teams.find((t) => t.id === assignment.assign_value);
    return team?.name || "Unknown Team";
  };

  const getAssignmentTypeLabel = (type: string) => {
    switch (type) {
      case "team": return "Team";
      case "is_external": return "Classification";
      case "user": return "Individual";
      default: return "User Type";
    }
  };

  const getAssignmentIcon = (type: string) => {
    switch (type) {
      case "team": return Users;
      case "user": return User;
      default: return UserCheck;
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-1">
            Assignments
            <InfoTooltip text="Assigning auto-enrols matching users. Removing does not unenrol existing users" />
          </CardTitle>
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Assign
          </Button>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No assignments. Assign this course to teams, user types, or individuals.
            </p>
          ) : (
            <div className="space-y-2">
              {assignments.map((assignment) => {
                const Icon = getAssignmentIcon(assignment.assign_type);
                return (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between rounded-lg border border-border p-2"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {getAssignmentLabel(assignment)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getAssignmentTypeLabel(assignment.assign_type)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(assignment)}
                      disabled={isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Assigning auto-enrols matching users. Removing an assignment does
              not unenrol already-enrolled users.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add Assignment Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) {
          setAssignValue("");
          setPreview({ loading: false });
          setError(null);
        }
      }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Assign Course</DialogTitle>
            <DialogDescription>
              Assign this course to a team, user type, or individual user. Matching
              users will be automatically enrolled.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Assignment Type</Label>
                <Select
                  value={assignType}
                  onValueChange={(v) => {
                    setAssignType(v);
                    setAssignValue("");
                    setPreview({ loading: false });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user_type">User Type</SelectItem>
                    <SelectItem value="is_external">Classification</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="user">Individual User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>
                  {assignType === "team"
                    ? "Select Team"
                    : assignType === "is_external"
                      ? "Select Classification"
                      : assignType === "user"
                        ? "Select User"
                        : "Select User Type"}
                </Label>
                {assignType === "user" ? (
                  <PersonCombobox
                    people={profiles}
                    value={assignValue || null}
                    onChange={(id) => setAssignValue(id ?? "")}
                    placeholder="Search for a user..."
                  />
                ) : (
                  <Select value={assignValue} onValueChange={setAssignValue}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          assignType === "team"
                            ? "Choose a team..."
                            : assignType === "is_external"
                              ? "Choose a classification..."
                              : "Choose a user type..."
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {assignType === "user_type" ? (
                        <SelectItem value="staff">All Staff</SelectItem>
                      ) : assignType === "is_external" ? (
                        <>
                          <SelectItem value="true">External Staff Only</SelectItem>
                          <SelectItem value="false">Internal Staff Only</SelectItem>
                        </>
                      ) : (
                        teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Assignment Preview */}
              {assignValue && (
                <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
                  {preview.loading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Calculating...
                    </div>
                  ) : preview.matchCount !== undefined ? (
                    <div className="space-y-1">
                      <p>
                        This will enrol{" "}
                        <strong>
                          {preview.matchCount - (preview.alreadyEnrolled ?? 0)} user
                          {preview.matchCount - (preview.alreadyEnrolled ?? 0) !== 1 ? "s" : ""}
                        </strong>
                        {(preview.alreadyEnrolled ?? 0) > 0 && (
                          <span className="text-muted-foreground">
                            {" "}({preview.alreadyEnrolled} already enrolled)
                          </span>
                        )}
                      </p>
                      {preview.sampleNames && preview.sampleNames.length > 0 && (
                        <details className="text-muted-foreground">
                          <summary className="cursor-pointer hover:text-foreground">
                            {preview.matchCount <= 5
                              ? "View names"
                              : `View first 5 of ${preview.matchCount}`}
                          </summary>
                          <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                            {preview.sampleNames.map((name) => (
                              <li key={name}>{name}</li>
                            ))}
                            {preview.matchCount > 5 && (
                              <li className="text-muted-foreground/70">
                                and {preview.matchCount - 5} more
                              </li>
                            )}
                          </ul>
                        </details>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !assignValue}>
                {isPending ? "Assigning..." : "Assign Course"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Assignment Confirmation Dialog */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the assignment for{" "}
              <strong>{removeTarget ? getAssignmentLabel(removeTarget) : ""}</strong>?
              New matching users will no longer be auto-enrolled, but existing
              enrolments will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogClose>
            <Button
              variant="destructive"
              onClick={handleConfirmRemove}
              disabled={isPending}
            >
              {isPending ? "Removing..." : "Remove"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
