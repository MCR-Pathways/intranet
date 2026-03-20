/**
 * Shared learning utilities used across server and client components.
 */

import {
  Shield,
  Lightbulb,
  Users,
  CheckCircle2,
  Circle,
  Lock,
  PlayCircle,
  Video as VideoIcon,
  FileText,
  Presentation,
  AlignLeft,
  HelpCircle,
} from "lucide-react";
import type { CourseCategory, LessonType } from "@/types/database.types";
import type { BadgeProps } from "@/components/ui/badge";

export interface CategoryConfig {
  label: string;
  icon: typeof Shield;
  color: string;
  bgColor: string;
  badgeVariant: NonNullable<BadgeProps["variant"]>;
}

export const categoryConfig: Record<CourseCategory, CategoryConfig> = {
  compliance: { label: "Compliance", icon: Shield, color: "text-red-600", bgColor: "bg-red-50", badgeVariant: "destructive" },
  upskilling: { label: "Upskilling", icon: Lightbulb, color: "text-blue-600", bgColor: "bg-blue-50", badgeVariant: "default" },
  soft_skills: { label: "Soft Skills", icon: Users, color: "text-purple-600", bgColor: "bg-purple-50", badgeVariant: "secondary" },
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
 * @deprecated Use getLockedSectionIds for section-based courses.
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

// ─── Section-based learning utilities ─────────────────────────────────────────

interface SectionInput {
  id: string;
  sort_order: number;
}

/**
 * Determines which sections are locked by unpassed section quizzes.
 * A section is locked if any preceding section (by sort_order) has an
 * active quiz that the learner has not yet passed.
 *
 * @param sections - All sections sorted by sort_order
 * @param passedQuizSectionIds - Set of section IDs where the learner has passed the quiz
 * @param sectionsWithQuizzes - Set of section IDs that have an active quiz
 * @returns A Set of locked section IDs.
 */
export function getLockedSectionIds(
  sections: SectionInput[],
  passedQuizSectionIds: Set<string>,
  sectionsWithQuizzes: Set<string>
): Set<string> {
  const locked = new Set<string>();
  let blockingQuizFound = false;

  for (const section of sections) {
    if (blockingQuizFound) {
      locked.add(section.id);
    } else if (
      sectionsWithQuizzes.has(section.id) &&
      !passedQuizSectionIds.has(section.id)
    ) {
      blockingQuizFound = true;
    }
  }

  return locked;
}

/**
 * Calculate progress for a section based on completed lessons and quiz status.
 * Returns a percentage 0-100.
 */
export function calculateSectionProgress(
  completedCount: number,
  totalCount: number,
  passedQuiz: boolean,
  hasQuiz: boolean
): number {
  if (totalCount === 0 && !hasQuiz) return 0;

  const totalItems = totalCount + (hasQuiz ? 1 : 0);
  const completedItems = completedCount + (passedQuiz ? 1 : 0);

  if (totalItems === 0) return 0;
  return Math.round((completedItems / totalItems) * 100);
}

/**
 * Validates quiz question options for correctness constraints.
 * Shared between legacy quiz and section quiz server actions.
 *
 * @param options - Array of options with is_correct flags
 * @param questionType - "single" (exactly 1 correct) or "multi" (at least 1 correct + 1 incorrect)
 * @returns Error message string, or null if valid.
 */
export function validateQuizOptions(
  options: { is_correct: boolean }[],
  questionType: "single" | "multi"
): string | null {
  if (options.length < 2) {
    return "At least 2 options are required";
  }

  const correctCount = options.filter((o) => o.is_correct).length;
  if (questionType === "single") {
    if (correctCount !== 1) {
      return "Exactly one correct answer is required";
    }
  } else {
    if (correctCount < 1) {
      return "At least one correct answer is required";
    }
    const incorrectCount = options.length - correctCount;
    if (incorrectCount < 1) {
      return "At least one incorrect option is required";
    }
  }

  return null;
}

/** Icon map for lesson progress states: completed, current, upcoming, locked */
export const lessonProgressIcons = {
  completed: CheckCircle2,
  current: Circle,
  upcoming: Circle,
  locked: Lock,
} as const;

/** Config for lesson types */
export const lessonTypeConfig: Record<
  LessonType,
  { label: string; icon: React.ElementType; color: string; bgColor: string }
> = {
  text: {
    label: "Plain Text",
    icon: FileText,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  rich_text: {
    label: "Rich Text",
    icon: AlignLeft,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
  },
  video: {
    label: "Video",
    icon: VideoIcon,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  slides: {
    label: "Slides",
    icon: Presentation,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  quiz: {
    label: "Quiz",
    icon: HelpCircle,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
};

/**
 * Format a duration in minutes to a human-readable string.
 * e.g. 90 → "1h 30m", 45 → "45m", 120 → "2h"
 */
export function formatLearningDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Tool Shed format configs ─────────────────────────────────────────────────

export interface ToolShedFieldDef {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
}

export interface ToolShedFormatConfig {
  label: string;
  description: string;
  fields: ToolShedFieldDef[];
}

export const toolShedFormats: Record<string, ToolShedFormatConfig> = {
  postcard: {
    label: "Postcard",
    description: "Write a postcard-style summary of what you learned",
    fields: [
      { key: "front", label: "Front (Key Takeaway)", placeholder: "What was the most important thing you learned?", multiline: true },
      { key: "back", label: "Back (How I'll Apply It)", placeholder: "How will you use this in your role?", multiline: true },
    ],
  },
  three_two_one: {
    label: "3-2-1",
    description: "3 things learned, 2 things to try, 1 question",
    fields: [
      { key: "three_1", label: "Learned 1", placeholder: "First thing you learned..." },
      { key: "three_2", label: "Learned 2", placeholder: "Second thing you learned..." },
      { key: "three_3", label: "Learned 3", placeholder: "Third thing you learned..." },
      { key: "two_1", label: "Will Try 1", placeholder: "First thing you'll try..." },
      { key: "two_2", label: "Will Try 2", placeholder: "Second thing you'll try..." },
      { key: "one", label: "Question", placeholder: "One question you still have..." },
    ],
  },
  takeover: {
    label: "Takeover",
    description: "Summarise as if teaching someone else",
    fields: [
      { key: "summary", label: "Summary", placeholder: "Explain the key concepts as if you were teaching a colleague...", multiline: true },
      { key: "action_items", label: "Action Items", placeholder: "What should someone do after learning this?", multiline: true },
    ],
  },
};
