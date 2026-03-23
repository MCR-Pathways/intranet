"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { enrollInCourse } from "./actions";

export function EnrollButton({
  courseId,
  hasLessons = true,
}: {
  courseId: string;
  /** Whether the course has lessons (determines button label) */
  hasLessons?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleEnroll() {
    startTransition(async () => {
      setError(null);
      const result = await enrollInCourse(courseId);
      if (result.success) {
        // Navigate directly to first lesson if available
        if (result.firstLessonId) {
          window.location.href = `/learning/courses/${courseId}/lessons/${result.firstLessonId}`;
        } else {
          // No lessons — stay on course page (external content course)
          toast.success("Enrolled successfully");
        }
      } else {
        setError(result.error ?? "Failed to enrol. Please try again.");
        toast.error(result.error ?? "Failed to enrol. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleEnroll} disabled={isPending} className="w-full">
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {hasLessons ? "Starting..." : "Enrolling..."}
          </>
        ) : (
          <>
            <PlayCircle className="h-4 w-4 mr-2" />
            {hasLessons ? "Enrol and Start" : "Enrol Now"}
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
