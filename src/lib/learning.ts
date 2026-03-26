/**
 * Shared learning utilities used across server and client components.
 *
 * Covers: category config, section-aware progress logic,
 * Tool Shed format config, and certificate utilities.
 */

import {
  Shield,
  Lightbulb,
  Users,
  FileText,
  FileCode2,
  PlayCircle,
  Presentation,
  CheckCircle2,
  Lock,
  Circle,
  Send,
  Layers,
  Megaphone,
} from "lucide-react";
import type { CourseCategory } from "@/types/database.types";
import type { BadgeProps } from "@/components/ui/badge";

// ─── Course Category Config ─────────────────────────────────────────────────

export interface CategoryConfig {
  label: string;
  icon: typeof Shield;
  color: string;
  bgColor: string;
  badgeVariant: NonNullable<BadgeProps["variant"]>;
}

export const categoryConfig: Record<CourseCategory, CategoryConfig> = {
  compliance: {
    label: "Compliance",
    icon: Shield,
    color: "text-red-600",
    bgColor: "bg-red-50",
    badgeVariant: "destructive",
  },
  upskilling: {
    label: "Upskilling",
    icon: Lightbulb,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    badgeVariant: "default",
  },
  soft_skills: {
    label: "Soft Skills",
    icon: Users,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    badgeVariant: "secondary",
  },
};

// ─── Lesson Type Config ─────────────────────────────────────────────────────

export type LessonType = "video" | "text" | "slides" | "rich_text";

export interface LessonTypeConfig {
  label: string;
  icon: typeof FileText;
}

export const lessonTypeConfig: Record<LessonType, LessonTypeConfig> = {
  video: { label: "Video", icon: PlayCircle },
  text: { label: "Text", icon: FileText },
  slides: { label: "Slides", icon: Presentation },
  rich_text: { label: "Rich Text", icon: FileCode2 },
};

// ─── Lesson Progress Icons ──────────────────────────────────────────────────

export const lessonProgressIcons = {
  completed: CheckCircle2,
  current: Circle,
  pending: Circle,
  locked: Lock,
} as const;

// ─── Section-Aware Locking Logic ────────────────────────────────────────────

export interface SectionInput {
  id: string;
  sort_order: number;
}

/**
 * Determines which sections are locked based on unpassed section quizzes.
 * A section is locked if ANY preceding section (by sort_order) has
 * an active quiz that the user hasn't passed.
 *
 * @param sections - All sections for a course, ordered by sort_order
 * @param passedQuizSectionIds - Set of section IDs where user has passed the quiz
 * @param sectionsWithQuizzes - Set of section IDs that HAVE an active quiz
 * @returns Set of locked section IDs
 */
export function getLockedSectionIds(
  sections: SectionInput[],
  passedQuizSectionIds: Set<string>,
  sectionsWithQuizzes: Set<string>
): Set<string> {
  const locked = new Set<string>();
  let blocking = false;

  for (const section of sections) {
    if (blocking) {
      locked.add(section.id);
    } else if (
      sectionsWithQuizzes.has(section.id) &&
      !passedQuizSectionIds.has(section.id)
    ) {
      // This section has an unpassed quiz — lock everything after it
      blocking = true;
    }
  }

  return locked;
}

/**
 * Calculate section-aware course progress.
 * Progress = (completed lessons + passed section quizzes) /
 *            (total active lessons + total active section quizzes)
 */
export function calculateSectionProgress(
  completedLessonCount: number,
  totalLessonCount: number,
  passedQuizCount: number,
  totalQuizCount: number
): number {
  const total = totalLessonCount + totalQuizCount;
  if (total === 0) return 0;
  const completed = completedLessonCount + passedQuizCount;
  return Math.round((completed / total) * 100);
}

// ─── Tool Shed Format Config ────────────────────────────────────────────────

export type ToolShedFormat = "postcard" | "three_two_one" | "takeover";

export interface ToolShedFormatConfig {
  label: string;
  shortLabel: string;
  icon: typeof Send;
  description: string;
  badgeVariant: NonNullable<BadgeProps["variant"]>;
  /** Tailwind classes for format-specific accent colouring */
  accent: {
    border: string;
    bg: string;
    text: string;
    iconBg: string;
    sectionBg: string;
    number: string;
    ring: string;
  };
  /** Short structural summary for format picker */
  structure: string;
}

export const toolShedFormatConfig: Record<ToolShedFormat, ToolShedFormatConfig> =
  {
    postcard: {
      label: "Digital Postcard",
      shortLabel: "Postcard",
      icon: Send,
      description:
        "A brief 4-part reflection covering what you learned, your key insight, the impact, and a recommendation.",
      badgeVariant: "default",
      accent: {
        border: "border-l-blue-500",
        bg: "bg-blue-50",
        text: "text-blue-700",
        iconBg: "bg-blue-100",
        sectionBg: "bg-blue-50/50",
        number: "bg-blue-100 text-blue-700",
        ring: "ring-blue-400",
      },
      structure: "4 reflective sections",
    },
    three_two_one: {
      label: "3-2-1 Model",
      shortLabel: "3-2-1",
      icon: Layers,
      description:
        "A structured reflection: 3 things learned, 2 changes you'll make, and 1 question for the team.",
      badgeVariant: "secondary",
      accent: {
        border: "border-l-violet-500",
        bg: "bg-violet-50",
        text: "text-violet-700",
        iconBg: "bg-violet-100",
        sectionBg: "bg-violet-50/50",
        number: "bg-violet-100 text-violet-700",
        ring: "ring-violet-400",
      },
      structure: "3 + 2 + 1 items",
    },
    takeover: {
      label: "10-Minute Takeover",
      shortLabel: "Takeover",
      icon: Megaphone,
      description:
        "The 3 most useful takeaways, ready to share in your next team meeting.",
      badgeVariant: "warning",
      accent: {
        border: "border-l-amber-500",
        bg: "bg-amber-50",
        text: "text-amber-700",
        iconBg: "bg-amber-100",
        sectionBg: "bg-amber-50/50",
        number: "bg-amber-100 text-amber-700",
        ring: "ring-amber-400",
      },
      structure: "3 key takeaways",
    },
  };

// ─── Tool Shed Content Types ────────────────────────────────────────────────

export interface PostcardContent {
  elevator_pitch: string;
  lightbulb_moment: string;
  programme_impact: string;
  golden_nugget: string;
}

export interface ThreeTwoOneContent {
  three_learned: string[];
  two_changes: string[];
  one_question: string;
}

export interface TakeoverContent {
  useful_things: string[];
}

export type ToolShedContent =
  | PostcardContent
  | ThreeTwoOneContent
  | TakeoverContent;

// ─── Tool Shed Postcard Field Config ────────────────────────────────────────

export const postcardFields = [
  {
    key: "elevator_pitch" as const,
    label: "Elevator Pitch",
    emoji: "🗣️",
    hint: "In two sentences, what was the training about?",
  },
  {
    key: "lightbulb_moment" as const,
    label: "The Lightbulb Moment",
    emoji: "💡",
    hint: "What was the one thing that made you go 'Aha!'?",
  },
  {
    key: "programme_impact" as const,
    label: "Impact on Our Programme",
    emoji: "🎯",
    hint: "How does this help us support young people, mentors, or colleagues better?",
  },
  {
    key: "golden_nugget" as const,
    label: "The Golden Nugget",
    emoji: "🏆",
    hint: "One resource, website, or technique we should all try.",
  },
] as const;

// ─── Certificate Utilities ──────────────────────────────────────────────────

/**
 * Format a certificate number for display.
 * Numbers are generated by the DB function `generate_certificate_number()`.
 * Format: MCR-YYYY-XXXXX (e.g. MCR-2026-00001)
 */
export function formatCertificateNumber(number: string): string {
  return number;
}

// ─── Notification Type Config ───────────────────────────────────────────────

export const learningNotificationTypes = {
  course_assigned: {
    title: "Course Assigned",
    icon: "📚",
  },
  certificate_earned: {
    title: "Certificate Earned",
    icon: "🏆",
  },
  course_overdue_7d: {
    title: "Course Due Soon",
    icon: "⚠️",
  },
  course_overdue_1d: {
    title: "Course Due Tomorrow",
    icon: "🚨",
  },
} as const;

// ─── Duration Formatting ────────────────────────────────────────────────────

/**
 * Format duration in minutes to a human-readable string.
 * e.g. 45 → "45 min", 90 → "1h 30 min", 120 → "2h"
 */
export function formatDuration(minutes: number | null): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining} min`;
}

// ─── Legacy (deprecated) ────────────────────────────────────────────────────

/**
 * @deprecated Use getLockedSectionIds instead.
 * Kept for backward compatibility during migration.
 */
export function getLockedLessonIds(
  lessons: { id: string; lesson_type: string | null }[],
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

// ─── Preview mode ──────────────────────────────────────────────────

/**
 * Determines if the current request is in admin preview mode.
 * Returns isPreview: true only if ?preview=true AND user is an L&D admin.
 * searchParamString can be appended to all internal navigation links.
 */
export function getPreviewMode(
  searchParams: Record<string, string | string[] | undefined>,
  profile: { is_ld_admin?: boolean; status?: string } | null
): { isPreview: boolean; searchParamString: string } {
  const previewParam = searchParams?.preview;
  const isPreviewRequested = previewParam === "true";

  if (!isPreviewRequested || !profile) {
    return { isPreview: false, searchParamString: "" };
  }

  // Only L&D admins can preview
  if (profile.status !== "active" || !profile.is_ld_admin) {
    return { isPreview: false, searchParamString: "" };
  }

  return { isPreview: true, searchParamString: "?preview=true" };
}
