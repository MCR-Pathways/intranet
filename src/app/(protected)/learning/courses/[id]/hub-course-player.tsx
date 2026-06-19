"use client";

import { useEffect, useRef, useTransition } from "react";
import CoursePlayer from "@/components/learning/hub-player/CoursePlayer";
import type { LoadedContent } from "@/types/chat-content";
import { ensureHubEnrolment, completeHubCourse } from "./hub-actions";

/**
 * Client wrapper around the ported Sparky course player for hub courses.
 *
 * The player itself is presentational (content arrives as props). This wrapper
 * owns the two server-action side effects: auto-enrol on open (so the catalogue
 * shows "Continue") and record completion when the learner reaches the final
 * step (which fires the native certificate + email + notification pipeline).
 * Preview mode (L&D admins) renders the player without writing any progress.
 */
export function HubCoursePlayer({
  content,
  courseId,
  initialStatus,
  isPreview,
}: {
  content: LoadedContent;
  courseId: string;
  initialStatus: string | null;
  isPreview: boolean;
}) {
  const [, startTransition] = useTransition();
  const enrolledRef = useRef(false);
  const completedRef = useRef(initialStatus === "completed");

  // Auto-enrol on first open (skip in preview or if already completed).
  useEffect(() => {
    if (isPreview || enrolledRef.current || completedRef.current) return;
    enrolledRef.current = true;
    startTransition(() => {
      ensureHubEnrolment(courseId).catch((err) => {
        enrolledRef.current = false;
        console.error("ensureHubEnrolment failed", err);
      });
    });
  }, [courseId, isPreview, startTransition]);

  function handleComplete(score?: number) {
    if (isPreview || completedRef.current) return;
    completedRef.current = true;
    startTransition(() => {
      completeHubCourse(courseId, score)
        .then((res) => {
          if (!res.success) {
            completedRef.current = false;
            console.error("completeHubCourse failed", res.error);
          }
        })
        .catch((err) => {
          completedRef.current = false;
          console.error("completeHubCourse failed", err);
        });
    });
  }

  return (
    <CoursePlayer
      content={content}
      onComplete={handleComplete}
      storageKey={`hub-course-${courseId}`}
    />
  );
}
