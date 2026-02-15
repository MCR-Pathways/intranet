"use client";

import { useState, useTransition } from "react";
import { completeLesson } from "../../actions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";

interface MarkCompleteButtonProps {
  lessonId: string;
  courseId: string;
  isCompleted: boolean;
}

export function MarkCompleteButton({
  lessonId,
  courseId,
  isCompleted,
}: MarkCompleteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isCompleted) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-medium">Completed</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await completeLesson(lessonId, courseId);
            if (!result.success) {
              setError(
                result.error ?? "Failed to mark complete. Please try again."
              );
            }
          })
        }
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Marking...
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark as Complete
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-destructive text-center mt-1">{error}</p>
      )}
    </div>
  );
}
