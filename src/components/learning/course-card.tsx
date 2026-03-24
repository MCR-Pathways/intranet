"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  };
  enrolment?: CourseEnrolment | null;
}

export function CourseCard({ course, enrolment }: CourseCardProps) {
  const config = categoryConfig[course.category as CourseCategory];
  const Icon = config?.icon;

  return (
    <Link href={`/learning/courses/${course.id}`}>
      <Card className="transition-shadow hover:shadow-md cursor-pointer h-full flex flex-col relative">
        {/* Minimal enrolment indicator */}
        {enrolment?.status === "completed" && (
          <div className="absolute top-3 right-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
        )}
        {enrolment?.status === "in_progress" && (
          <div className="absolute top-3 right-3">
            <div
              className="h-5 w-5 rounded-full border-2 border-blue-500"
              style={{
                background: `conic-gradient(rgb(59 130 246) ${(enrolment.progress_percent ?? 0) * 3.6}deg, transparent 0deg)`,
              }}
              title={`${enrolment.progress_percent}% complete`}
            />
          </div>
        )}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              {Icon && <Icon className={`h-5 w-5 ${config.color}`} />}
              <CardTitle className="text-base line-clamp-2">{course.title}</CardTitle>
            </div>
            {course.is_required && (
              <Badge variant="destructive" className="shrink-0">Required</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <CardDescription className="line-clamp-2 mb-4 flex-1">
            {course.description}
          </CardDescription>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(course.duration_minutes ?? null)}
            </div>
            {config && (
              <Badge variant="outline" className="text-xs">
                {config.label}
              </Badge>
            )}
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
