"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";
import type { CourseEnrolment } from "@/types/database.types";
import type { AlgoliaCourseRecord } from "@/lib/algolia";
import { formatDuration } from "@/lib/utils";
import { categoryConfig } from "@/lib/learning";
import type { CourseCategory } from "@/types/database.types";

interface CourseCardProps {
  course: {
    id: string;
    title: string;
    description?: string | null;
    category: string;
    duration_minutes?: number | null;
    is_required?: boolean;
    sectionCount?: number;
    lessonCount?: number;
  };
  enrolment?: CourseEnrolment | null;
}

export function CourseCard({ course, enrolment }: CourseCardProps) {
  const config = categoryConfig[course.category as CourseCategory];
  const Icon = config?.icon;

  return (
    <Link href={`/learning/courses/${course.id}`}>
      <Card
        className={`border-l-4 ${config?.borderColor ?? "border-l-muted"} shadow-sm overflow-clip rounded-xl transition-shadow hover:shadow-md cursor-pointer h-full flex flex-col relative`}
      >
        {/* Enrolment status indicator */}
        {enrolment?.status === "completed" && (
          <div className="absolute top-3 right-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
        )}
        {enrolment?.status === "in_progress" && (
          <div className="absolute top-3 right-3">
            <Badge variant="default" className="text-xs tabular-nums">
              {enrolment.progress_percent}%
            </Badge>
          </div>
        )}
        {enrolment &&
          enrolment.status !== "completed" &&
          enrolment.status !== "in_progress" && (
            <div className="absolute top-3 right-3">
              <Badge variant="muted" className="text-xs">
                Enrolled
              </Badge>
            </div>
          )}
        <CardHeader className="pb-3">
          <div className="pr-16">
            <div className="flex items-center gap-2">
              {Icon && <Icon className={`h-5 w-5 ${config.color} shrink-0`} />}
              <CardTitle className="text-[15px] font-semibold line-clamp-2">
                {course.title}
              </CardTitle>
            </div>
            {course.is_required && (
              <Badge variant="destructive" className="mt-2">
                Required
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <CardDescription className="line-clamp-2 mb-4 flex-1">
            {course.description}
          </CardDescription>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              {course.duration_minutes ? (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDuration(course.duration_minutes)}
                </span>
              ) : null}
              {(course.sectionCount ?? 0) > 0 && (
                <span>
                  {course.sectionCount} {course.sectionCount === 1 ? "section" : "sections"} &middot;{" "}
                  {course.lessonCount} {course.lessonCount === 1 ? "lesson" : "lessons"}
                </span>
              )}
              {(course.sectionCount ?? 0) === 0 && (course.lessonCount ?? 0) > 0 && (
                <span>
                  {course.lessonCount} {course.lessonCount === 1 ? "lesson" : "lessons"}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/** Adapt an Algolia hit to CourseCard props */
export function algoliaHitToCourseCardProps(hit: AlgoliaCourseRecord) {
  return {
    id: hit.courseId,
    title: hit.title,
    description: hit.description,
    category: hit.category,
    duration_minutes: hit.duration,
    is_required: hit.isRequired,
  };
}
