"use client";

import { useState, useTransition } from "react";
import { completeLesson } from "../../actions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { LessonType } from "@/types/database.types";
import Link from "next/link";

interface MarkCompleteButtonProps {
  lessonId: string;
  courseId: string;
  isCompleted: boolean;
  /** Lesson type — auto-completing uploaded videos hide this button */
  lessonType?: LessonType;
  /** Whether the video lesson has an uploaded video (auto-completes on ended) */
  hasUploadedVideo?: boolean;
  /** Where to navigate after completing. If null, no navigation (last lesson or already completed). */
  nextHref?: string | null;
  /** Label for the next action (e.g. "Continue", "Take Quiz", "Complete Course") */
  nextLabel?: string;
}

export function MarkCompleteButton({
  lessonId,
  courseId,
  isCompleted,
  lessonType = "text",
  hasUploadedVideo = false,
  nextHref,
  nextLabel = "Continue",
}: MarkCompleteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Completed state — show "Continue" link if there's a next destination
  if (isCompleted) {
    if (nextHref) {
      return (
        <Button asChild>
          <Link href={nextHref}>
            {nextLabel}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      );
    }
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-medium">Completed</span>
      </div>
    );
  }

  // Uploaded video lessons: auto-complete on video end, no manual button needed
  if (lessonType === "video" && hasUploadedVideo) {
    return null;
  }

  // "Complete and Continue" — marks complete AND navigates to next
  const buttonLabel = nextHref
    ? `Complete and ${nextLabel}`
    : lessonType === "text"
      ? "Mark as Read"
      : "Mark as Complete";

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await completeLesson(lessonId, courseId);
            if (result.success) {
              if (nextHref) {
                // Append ?completed=true when navigating back to the course page
                // (not to another lesson or quiz) to trigger celebration
                const isCoursePageNav = nextHref === `/learning/courses/${courseId}`;
                window.location.href = isCoursePageNav
                  ? `${nextHref}?completed=true`
                  : nextHref;
              } else {
                toast.success("Lesson completed");
              }
            } else {
              setError(
                result.error ?? "Failed to mark complete. Please try again."
              );
              toast.error(result.error ?? "Failed to mark complete. Please try again.");
            }
          })
        }
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {nextHref ? "Completing..." : "Marking..."}
          </>
        ) : (
          <>
            {nextHref ? (
              <ArrowRight className="h-4 w-4 mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
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
