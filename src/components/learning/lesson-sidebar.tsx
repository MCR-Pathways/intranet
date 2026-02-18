"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PlayCircle,
  FileText,
  HelpCircle,
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
  isCompleted: boolean;
  isLocked: boolean;
}

interface LessonSidebarProps {
  courseId: string;
  courseTitle: string;
  lessons: LessonSidebarItem[];
  currentLessonId: string;
}

const lessonTypeIcon: Record<LessonType, typeof PlayCircle> = {
  video: PlayCircle,
  text: FileText,
  quiz: HelpCircle,
};

export function LessonSidebar({
  courseId,
  courseTitle,
  lessons,
  currentLessonId,
}: LessonSidebarProps) {
  const completedCount = lessons.filter((l) => l.isCompleted).length;
  const totalCount = lessons.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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
        <div className="space-y-1 p-2">
          {lessons.map((lesson, index) => {
            const isCurrent = lesson.id === currentLessonId;
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
              <Link
                key={lesson.id}
                href={`/learning/courses/${courseId}/lessons/${lesson.id}`}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
