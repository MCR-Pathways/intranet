"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Lock,
  BookOpen,
  PlayCircle,
  FileText,
  HelpCircle,
} from "lucide-react";
import type { CourseLesson, LessonType } from "@/types/database.types";

interface LessonListProps {
  courseId: string;
  lessons: CourseLesson[];
  completedLessonIds: string[];
  isEnrolled: boolean;
}

const lessonTypeIcon: Record<LessonType, typeof FileText> = {
  video: PlayCircle,
  text: FileText,
  quiz: HelpCircle,
};

const lessonTypeLabel: Record<LessonType, string> = {
  video: "Video",
  text: "Text",
  quiz: "Quiz",
};

export function LessonList({
  courseId,
  lessons,
  completedLessonIds,
  isEnrolled,
}: LessonListProps) {
  const completedCount = completedLessonIds.length;
  const totalCount = lessons.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Determine which lessons are locked by unpassed quizzes
  const lockedLessonIds = useMemo(() => {
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
  }, [lessons, completedLessonIds]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Course Content
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {completedCount} of {totalCount} lessons completed
          </span>
        </div>
        {isEnrolled && totalCount > 0 && (
          <Progress value={progressPercent} className="mt-2" />
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {lessons.map((lesson, index) => {
            const isCompleted = completedLessonIds.includes(lesson.id);
            const isLocked = isEnrolled && lockedLessonIds.has(lesson.id);
            const lessonType = (lesson.lesson_type ?? "text") as LessonType;
            const TypeIcon = lessonTypeIcon[lessonType];

            // Unenrolled users: all lessons locked
            if (!isEnrolled) {
              return (
                <div
                  key={lesson.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-muted-foreground"
                >
                  <Lock className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium text-muted-foreground w-6">
                    {index + 1}.
                  </span>
                  <span className="text-sm flex-1">{lesson.title}</span>
                  <Badge variant="outline" className="text-xs">
                    {lessonTypeLabel[lessonType]}
                  </Badge>
                </div>
              );
            }

            // Enrolled but locked by unpassed quiz
            if (isLocked) {
              return (
                <div
                  key={lesson.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-muted-foreground/50"
                  title="Complete the preceding quiz to unlock"
                >
                  <Lock className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium w-6">
                    {index + 1}.
                  </span>
                  <span className="text-sm flex-1">{lesson.title}</span>
                  <Badge variant="outline" className="text-xs opacity-50">
                    {lessonTypeLabel[lessonType]}
                  </Badge>
                </div>
              );
            }

            // Enrolled and accessible
            return (
              <Link
                key={lesson.id}
                href={`/learning/courses/${courseId}/lessons/${lesson.id}`}
                className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors"
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                ) : (
                  <TypeIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-medium text-muted-foreground w-6">
                  {index + 1}.
                </span>
                <span
                  className={`text-sm flex-1 ${isCompleted ? "text-muted-foreground" : "font-medium"}`}
                >
                  {lesson.title}
                </span>
                <Badge variant="outline" className="text-xs">
                  {lessonTypeLabel[lessonType]}
                </Badge>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
