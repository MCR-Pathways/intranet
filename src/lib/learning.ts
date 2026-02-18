/**
 * Shared learning utilities used across server and client components.
 */

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
