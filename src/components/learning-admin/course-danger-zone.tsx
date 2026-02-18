"use client";

import { useState, useTransition } from "react";
import {
  toggleCourseActive,
  unpublishCourse,
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
import { AlertTriangle, Eye, EyeOff, Undo2 } from "lucide-react";

interface CourseDangerZoneProps {
  courseId: string;
  courseTitle: string;
  isActive: boolean;
  status: "draft" | "published";
  enrollmentCount: number;
}

export function CourseDangerZone({
  courseId,
  courseTitle,
  isActive,
  status,
  enrollmentCount,
}: CourseDangerZoneProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showUnpublishDialog, setShowUnpublishDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    if (isActive) {
      setShowDeactivateDialog(true);
    } else {
      // Activate immediately, no confirmation needed
      startTransition(async () => {
        await toggleCourseActive(courseId, true);
      });
    }
  };

  const handleConfirmDeactivate = () => {
    startTransition(async () => {
      await toggleCourseActive(courseId, false);
      setShowDeactivateDialog(false);
    });
  };

  const handleUnpublish = () => {
    setError(null);
    startTransition(async () => {
      const result = await unpublishCourse(courseId);
      if (!result.success) {
        setError(result.error ?? "Failed to revert to draft.");
      } else {
        setShowUnpublishDialog(false);
      }
    });
  };

  // Don't show danger zone for drafts — they already have the draft banner
  if (status === "draft") return null;

  return (
    <>
      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Deactivate / Activate toggle — only for published courses */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {isActive ? "Deactivate course" : "Activate course"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isActive
                  ? "Hide this course from all learners immediately."
                  : "Make this course visible to learners again."}
              </p>
            </div>
            <Button
              variant={isActive ? "destructive" : "default"}
              size="sm"
              onClick={handleToggle}
              disabled={isPending}
            >
              {isActive ? (
                <>
                  <EyeOff className="h-3.5 w-3.5 mr-1" />
                  {isPending ? "Deactivating..." : "Deactivate"}
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  {isPending ? "Activating..." : "Activate"}
                </>
              )}
            </Button>
          </div>

          {/* Revert to Draft — only if 0 enrollments */}
          {enrollmentCount === 0 && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <div>
                <p className="text-sm font-medium">Revert to draft</p>
                <p className="text-xs text-muted-foreground">
                  Unpublish and return this course to draft status.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUnpublishDialog(true)}
                disabled={isPending}
              >
                <Undo2 className="h-3.5 w-3.5 mr-1" />
                Revert to Draft
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deactivate confirmation dialog */}
      <AlertDialog
        open={showDeactivateDialog}
        onOpenChange={(open) => {
          if (!open) setShowDeactivateDialog(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Course</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate &quot;{courseTitle}&quot;? It
              will be hidden from all learners immediately. You can reactivate it
              at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogClose>
            <Button
              variant="destructive"
              onClick={handleConfirmDeactivate}
              disabled={isPending}
            >
              {isPending ? "Deactivating..." : "Deactivate"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unpublish confirmation dialog */}
      <AlertDialog
        open={showUnpublishDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowUnpublishDialog(false);
            setError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert to Draft</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revert &quot;{courseTitle}&quot; to draft?
              It will be hidden from learners and moved back to draft status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p className="text-sm text-destructive px-6">{error}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogClose>
            <Button
              variant="destructive"
              onClick={handleUnpublish}
              disabled={isPending}
            >
              {isPending ? "Reverting..." : "Revert to Draft"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
