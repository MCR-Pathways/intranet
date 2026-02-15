"use client";

import { useTransition } from "react";
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

  if (isCompleted) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-medium">Completed</span>
      </div>
    );
  }

  return (
    <Button
      onClick={() =>
        startTransition(async () => {
          await completeLesson(lessonId, courseId);
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
  );
}
