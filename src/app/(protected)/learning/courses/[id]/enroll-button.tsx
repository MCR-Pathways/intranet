"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen } from "lucide-react";
import { enrollInCourse } from "./actions";

export function EnrollButton({
  courseId,
}: {
  courseId: string;
  userId?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleEnroll() {
    startTransition(async () => {
      setError(null);
      const result = await enrollInCourse(courseId);
      if (!result.success) {
        setError(result.error ?? "Failed to enrol. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleEnroll} disabled={isPending} className="w-full">
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Enrolling...
          </>
        ) : (
          <>
            <BookOpen className="h-4 w-4 mr-2" />
            Enroll Now
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
