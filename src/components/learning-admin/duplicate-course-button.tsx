"use client";

import { useState, useTransition } from "react";
import { duplicateCourse } from "@/app/(protected)/learning/admin/courses/actions";
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
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface DuplicateCourseButtonProps {
  courseId: string;
  courseTitle: string;
}

export function DuplicateCourseButton({
  courseId,
  courseTitle,
}: DuplicateCourseButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDuplicate = () => {
    startTransition(async () => {
      const result = await duplicateCourse(courseId);
      if (result.success && result.newCourseId) {
        toast.success("Course duplicated");
        setShowConfirm(false);
        window.location.href = `/learning/admin/courses/${result.newCourseId}`;
      } else {
        toast.error(result.error || "Failed to duplicate course");
      }
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => setShowConfirm(true)}
      >
        <Copy className="h-4 w-4 mr-1.5" />
        Duplicate
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Course</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a draft copy of &ldquo;{courseTitle}&rdquo; including
              all sections, lessons, and quiz questions. Enrolments and learner
              progress will not be copied.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogClose>
            <Button onClick={handleDuplicate} disabled={isPending}>
              {isPending ? "Duplicating..." : "Duplicate"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
