"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PlayCircle,
  FileText,
  FileCode2,
  Presentation,
  CheckCircle2,
  Circle,
  Lock,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { LessonType } from "@/types/database.types";

interface LessonSidebarItem {
  id: string;
  title: string;
  lesson_type: LessonType;
  sort_order: number;
  sectionId?: string | null;
  isCompleted: boolean;
  isLocked: boolean;
}

interface SidebarSection {
  id: string;
  title: string;
}

interface LessonSidebarProps {
  courseId: string;
  courseTitle: string;
  lessons: LessonSidebarItem[];
  currentLessonId: string;
  sections?: SidebarSection[];
}

const lessonTypeIcon: Record<LessonType, typeof PlayCircle> = {
  video: PlayCircle,
  text: FileText,
  slides: Presentation,
  rich_text: FileCode2,
};

function LessonRow({
  lesson,
  index,
  courseId,
  isCurrent,
}: {
  lesson: LessonSidebarItem;
  index: number;
  courseId: string;
  isCurrent: boolean;
}) {
  const Icon = lesson.isLocked
    ? Lock
    : lesson.isCompleted
      ? CheckCircle2
      : lessonTypeIcon[lesson.lesson_type] || Circle;

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        isCurrent && "bg-primary/10 text-primary",
        !isCurrent &&
          !lesson.isLocked &&
          "text-foreground/70 hover:bg-muted hover:text-foreground",
        lesson.isLocked && "cursor-not-allowed text-muted-foreground/50"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          lesson.isCompleted && "text-green-600",
          isCurrent && !lesson.isCompleted && "text-primary",
          lesson.isLocked && "text-muted-foreground/40"
        )}
      />
      <div className="flex-1 min-w-0">
        <p className="line-clamp-2 font-medium leading-tight">
          {index + 1}. {lesson.title}
        </p>
      </div>
    </div>
  );

  if (lesson.isLocked) {
    return (
      <div key={lesson.id} title="Complete the preceding quiz to unlock">
        {content}
      </div>
    );
  }

  return (
    <Link key={lesson.id} href={`/learning/courses/${courseId}/lessons/${lesson.id}`}>
      {content}
    </Link>
  );
}

export function LessonSidebar({
  courseId,
  courseTitle,
  lessons,
  currentLessonId,
  sections,
}: LessonSidebarProps) {
  const completedCount = lessons.filter((l) => l.isCompleted).length;
  const totalCount = lessons.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Group lessons by section when sections are provided
  const groupedLessons = useMemo(() => {
    if (!sections || sections.length === 0) return null;

    const groups: {
      section: SidebarSection;
      lessons: LessonSidebarItem[];
    }[] = [];

    const lessonsBySection = new Map<string, LessonSidebarItem[]>();

    for (const lesson of lessons) {
      const key = lesson.sectionId ?? "__none__";
      const list = lessonsBySection.get(key) ?? [];
      list.push(lesson);
      lessonsBySection.set(key, list);
    }

    for (const section of sections) {
      const sectionLessons = lessonsBySection.get(section.id) ?? [];
      if (sectionLessons.length > 0) {
        groups.push({ section, lessons: sectionLessons });
      }
    }

    // Any lessons without a section go at the end
    const unsectioned = lessonsBySection.get("__none__");
    if (unsectioned && unsectioned.length > 0) {
      groups.push({
        section: { id: "__none__", title: "Other" },
        lessons: unsectioned,
      });
    }

    return groups;
  }, [sections, lessons]);

  // Global lesson index for numbering
  let globalIndex = 0;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="border-b border-border p-4">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/learning/courses/${courseId}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Course
          </Link>
        </Button>
        <h2 className="line-clamp-2 text-sm font-bold">{courseTitle}</h2>
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {completedCount} of {totalCount} completed
            </span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      </div>

      {/* Lesson list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {groupedLessons ? (
            // Section-grouped layout
            groupedLessons.map((group, groupIdx) => {
              const sectionCompleted = group.lessons.filter(
                (l) => l.isCompleted
              ).length;
              const sectionTotal = group.lessons.length;
              const startIndex = globalIndex;
              globalIndex += sectionTotal;

              return (
                <div key={group.section.id} className={cn(groupIdx > 0 && "mt-3")}>
                  {/* Section header */}
                  <div className="flex items-center justify-between px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
                      {group.section.title}
                    </p>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">
                      {sectionCompleted}/{sectionTotal}
                    </span>
                  </div>
                  {/* Section lessons */}
                  <div className="space-y-0.5">
                    {group.lessons.map((lesson, i) => (
                      <LessonRow
                        key={lesson.id}
                        lesson={lesson}
                        index={startIndex + i}
                        courseId={courseId}
                        isCurrent={lesson.id === currentLessonId}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            // Flat layout (backwards compatible)
            <div className="space-y-1">
              {lessons.map((lesson, index) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  index={index}
                  courseId={courseId}
                  isCurrent={lesson.id === currentLessonId}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
