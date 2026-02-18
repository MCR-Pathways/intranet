"use client";

import { useState, useTransition } from "react";
import { toggleCourseActive } from "@/app/(protected)/learning/admin/courses/actions";
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
import { AlertTriangle, Eye, EyeOff } from "lucide-react";

interface CourseDangerZoneProps {
  courseId: string;
  courseTitle: string;
  isActive: boolean;
}

export function CourseDangerZone({
  courseId,
  courseTitle,
  isActive,
}: CourseDangerZoneProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

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

  return (
    <>
      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

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
    </>
  );
}
