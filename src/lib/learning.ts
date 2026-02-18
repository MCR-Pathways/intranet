/**
 * Shared learning utilities used across server and client components.
 */

import { Shield, Lightbulb, Users } from "lucide-react";
import type { CourseCategory } from "@/types/database.types";

export interface CategoryConfig {
  label: string;
  icon: typeof Shield;
  color: string;
  bgColor: string;
}

export const categoryConfig: Record<CourseCategory, CategoryConfig> = {
  compliance: { label: "Compliance", icon: Shield, color: "text-red-600", bgColor: "bg-red-50" },
  upskilling: { label: "Upskilling", icon: Lightbulb, color: "text-blue-600", bgColor: "bg-blue-50" },
  soft_skills: { label: "Soft Skills", icon: Users, color: "text-purple-600", bgColor: "bg-purple-50" },
};

interface LockableLessonInput {
  id: string;
  lesson_type: string | null;
}

/**
 * Determines which lessons are locked by unpassed quizzes.
 * A lesson is locked if any preceding quiz lesson (by array order,
 * which should match sort_order) has not been completed.
 *
 * @returns A Set of locked lesson IDs.
 */
export function getLockedLessonIds(
  lessons: LockableLessonInput[],
  completedLessonIds: string[]
): Set<string> {
  const locked = new Set<string>();
  let blockingQuizFound = false;

  for (const l of lessons) {
    if (blockingQuizFound) {
      locked.add(l.id);
    } else if (
      l.lesson_type === "quiz" &&
      !completedLessonIds.includes(l.id)
    ) {
      blockingQuizFound = true;
    }
  }

  return locked;
}
