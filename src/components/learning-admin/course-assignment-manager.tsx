"use client";

import { useState, useTransition } from "react";
import {
  assignCourse,
  removeAssignment,
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
import { Plus, X, Users, UserCheck } from "lucide-react";
import type { CourseAssignment, Team } from "@/types/database.types";

const userTypeLabels: Record<string, string> = {
  staff: "Staff",
  pathways_coordinator: "Pathways Coordinator",
  new_user: "New User",
};

interface CourseAssignmentManagerProps {
  courseId: string;
  assignments: CourseAssignment[];
  teams: Pick<Team, "id" | "name">[];
}

export function CourseAssignmentManager({
  courseId,
  assignments,
  teams,
}: CourseAssignmentManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [showDialog, setShowDialog] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<CourseAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [assignType, setAssignType] = useState<string>("user_type");
  const [assignValue, setAssignValue] = useState<string>("");

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
        setAssignValue("");
        setShowDialog(false);
      } else {
        setError(result.error || "Failed to assign course");
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
      setRemoveTarget(null);
    });
  };

  const getAssignmentLabel = (assignment: CourseAssignment) => {
    if (assignment.assign_type === "user_type") {
      return userTypeLabels[assignment.assign_value] || assignment.assign_value;
    }
    const team = teams.find((t) => t.id === assignment.assign_value);
    return team?.name || "Unknown Team";
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Assignments</CardTitle>
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Assign
          </Button>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No assignments. Assign this course to teams or user types.
            </p>
          ) : (
            <div className="space-y-2">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between rounded-lg border border-border p-2"
                >
                  <div className="flex items-center gap-2">
                    {assignment.assign_type === "team" ? (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <UserCheck className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {getAssignmentLabel(assignment)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {assignment.assign_type === "team"
                          ? "Team"
                          : "User Type"}
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
              ))}
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
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Assign Course</DialogTitle>
            <DialogDescription>
              Assign this course to a team or user type. All matching users will
              be automatically enrolled.
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
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user_type">User Type</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>
                  {assignType === "team" ? "Select Team" : "Select User Type"}
                </Label>
                <Select value={assignValue} onValueChange={setAssignValue}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        assignType === "team"
                          ? "Choose a team..."
                          : "Choose a user type..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {assignType === "user_type" ? (
                      <>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="pathways_coordinator">
                          Pathways Coordinator
                        </SelectItem>
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
              </div>

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
              enrollments will not be affected.
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
