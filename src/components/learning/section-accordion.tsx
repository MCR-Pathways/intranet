"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  Lock,
  ChevronRight,
  ChevronDown,
  BookOpen,
  PlayCircle,
  FileText,
  FileCode2,
  Presentation,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LessonType } from "@/types/database.types";

interface SectionLesson {
  id: string;
  title: string;
  lesson_type: LessonType;
  isCompleted: boolean;
}

interface Section {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  lessons: SectionLesson[];
  hasQuiz: boolean;
  quizPassed: boolean;
  isLocked: boolean;
}

interface SectionAccordionProps {
  courseId: string;
  sections: Section[];
  isEnrolled: boolean;
}

const lessonTypeIcon: Record<LessonType, typeof FileText> = {
  video: PlayCircle,
  text: FileText,
  slides: Presentation,
  rich_text: FileCode2,
};

/**
 * Expandable accordion showing course sections with lessons and quiz status.
 * Used on the course detail page to give learners a structured overview
 * of section-based courses.
 */
export function SectionAccordion({
  courseId,
  sections,
  isEnrolled,
}: SectionAccordionProps) {
  // Auto-expand the first non-complete, unlocked section
  const initialExpanded = (() => {
    if (!isEnrolled) return new Set<string>();

    const firstActionable = sections.find((s) => {
      if (s.isLocked) return false;
      const allLessonsComplete = s.lessons.every((l) => l.isCompleted);
      const sectionFullyComplete = allLessonsComplete && (!s.hasQuiz || s.quizPassed);
      return !sectionFullyComplete;
    });

    return firstActionable ? new Set([firstActionable.id]) : new Set<string>();
  })();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(initialExpanded);

  function toggleSection(sectionId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  const totalLessons = sections.reduce((sum, s) => sum + s.lessons.length, 0);
  const completedLessons = sections.reduce(
    (sum, s) => sum + s.lessons.filter((l) => l.isCompleted).length,
    0
  );
  const progressPercent =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Course Content
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {completedLessons} of {totalLessons} lessons completed
          </span>
        </div>
        {isEnrolled && totalLessons > 0 && (
          <Progress value={progressPercent} className="mt-2" />
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {sections.map((section, sectionIndex) => {
          const isExpanded = expandedSections.has(section.id);
          const isLocked = !isEnrolled || section.isLocked;
          const completedCount = section.lessons.filter((l) => l.isCompleted).length;
          const totalCount = section.lessons.length;
          const sectionComplete =
            isEnrolled &&
            completedCount === totalCount &&
            (!section.hasQuiz || section.quizPassed);

          return (
            <div
              key={section.id}
              className={cn(
                "rounded-lg border",
                isLocked
                  ? "border-border/50 bg-muted/30"
                  : sectionComplete
                    ? "border-green-200 bg-green-50/30"
                    : "border-border"
              )}
            >
              {/* Section header */}
              <button
                type="button"
                disabled={isLocked}
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colours",
                  !isLocked && "hover:bg-muted/50",
                  isLocked && "cursor-not-allowed"
                )}
              >
                {/* Expand/collapse or lock icon */}
                {isLocked ? (
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                ) : sectionComplete ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                ) : isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}

                {/* Section number + title */}
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "text-sm font-semibold",
                      isLocked && "text-muted-foreground/50"
                    )}
                  >
                    Section {sectionIndex + 1}: {section.title}
                  </div>
                  {section.description && (
                    <p
                      className={cn(
                        "text-xs mt-0.5 truncate",
                        isLocked
                          ? "text-muted-foreground/40"
                          : "text-muted-foreground"
                      )}
                    >
                      {section.description}
                    </p>
                  )}
                </div>

                {/* Progress indicator */}
                {isEnrolled && !isLocked && (
                  <span
                    className={cn(
                      "text-xs font-medium shrink-0",
                      sectionComplete
                        ? "text-green-600"
                        : "text-muted-foreground"
                    )}
                  >
                    {completedCount}/{totalCount} complete
                  </span>
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && !isLocked && (
                <div className="border-t px-4 py-2">
                  <div className="space-y-1">
                    {section.lessons.map((lesson, lessonIndex) => {
                      const TypeIcon = lessonTypeIcon[lesson.lesson_type] ?? FileText;

                      return (
                        <Link
                          key={lesson.id}
                          href={`/learning/courses/${courseId}/lessons/${lesson.id}`}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colours"
                        >
                          {lesson.isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-blue-500 shrink-0" />
                          )}
                          <span className="text-xs font-medium text-muted-foreground w-5">
                            {lessonIndex + 1}.
                          </span>
                          <span
                            className={cn(
                              "text-sm flex-1",
                              lesson.isCompleted
                                ? "text-muted-foreground"
                                : "font-medium"
                            )}
                          >
                            {lesson.title}
                          </span>
                          <TypeIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </Link>
                      );
                    })}

                    {/* Section quiz row */}
                    {section.hasQuiz && (
                      <div className="mt-1 border-t pt-2">
                        {section.quizPassed ? (
                          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm flex-1 text-muted-foreground">
                              Section Quiz
                            </span>
                            <Badge variant="success">Quiz Passed</Badge>
                          </div>
                        ) : (
                          <Link
                            href={`/learning/courses/${courseId}/sections/${section.id}/quiz`}
                            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colours"
                          >
                            <Circle className="h-4 w-4 text-amber-500 shrink-0" />
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm flex-1 font-medium">
                              Section Quiz
                            </span>
                            <Badge variant="warning">Quiz Required</Badge>
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Locked section: show quiz badge if applicable */}
              {isLocked && section.hasQuiz && (
                <div className="border-t px-4 py-2">
                  <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                    <Lock className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    <span className="text-sm flex-1 text-muted-foreground/40">
                      Section Quiz
                    </span>
                    <Badge variant="muted">Quiz Locked</Badge>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
