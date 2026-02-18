"use client";

import { useState, useTransition } from "react";
import { completeLesson } from "../../actions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { LessonType } from "@/types/database.types";

interface MarkCompleteButtonProps {
  lessonId: string;
  courseId: string;
  isCompleted: boolean;
  /** Lesson type — quiz and auto-completing videos hide this button */
  lessonType?: LessonType;
  /** Whether the video lesson has an uploaded video (auto-completes on ended) */
  hasUploadedVideo?: boolean;
}

export function MarkCompleteButton({
  lessonId,
  courseId,
  isCompleted,
  lessonType = "text",
  hasUploadedVideo = false,
}: MarkCompleteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Completed state — always shown regardless of type
  if (isCompleted) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-medium">Completed</span>
      </div>
    );
  }

  // Quiz lessons: completion is handled by QuizPlayer (pass to complete)
  if (lessonType === "quiz") {
    return null;
  }

  // Uploaded video lessons: auto-complete on video end, no manual button needed
  if (lessonType === "video" && hasUploadedVideo) {
    return null;
  }

  // Text lessons and external video lessons: show manual complete button
  const buttonLabel =
    lessonType === "text" ? "Mark as Read" : "Mark as Complete";

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
            {buttonLabel}
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-destructive text-center mt-1">{error}</p>
      )}
    </div>
  );
}
