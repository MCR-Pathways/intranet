"use client";

import { useTransition } from "react";
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

  function handleEnroll() {
    startTransition(async () => {
      const result = await enrollInCourse(courseId);
      if (!result.success) {
        console.error("Enrollment error:", result.error);
      }
    });
  }

  return (
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
  );
}
