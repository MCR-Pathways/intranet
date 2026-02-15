"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Lock, BookOpen } from "lucide-react";
import type { CourseLesson } from "@/types/database.types";

interface LessonListProps {
  courseId: string;
  lessons: CourseLesson[];
  completedLessonIds: string[];
  isEnrolled: boolean;
}

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
                  <span className="text-sm">{lesson.title}</span>
                </div>
              );
            }

            return (
              <Link
                key={lesson.id}
                href={`/learning/courses/${courseId}/lessons/${lesson.id}`}
                className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors"
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-medium text-muted-foreground w-6">
                  {index + 1}.
                </span>
                <span
                  className={`text-sm ${isCompleted ? "text-muted-foreground" : "font-medium"}`}
                >
                  {lesson.title}
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
