"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  CheckCircle2,
  PlayCircle,
  AlertTriangle,
  Download,
} from "lucide-react";
import type { EnrolmentWithCourse } from "@/types/database.types";
import { formatDuration } from "@/lib/utils";
import { categoryConfig } from "@/lib/learning";

interface EnrolledCourseCardProps {
  enrolment: EnrolmentWithCourse;
  resumeLessonId?: string | null;
}

export function EnrolledCourseCard({ enrolment, resumeLessonId }: EnrolledCourseCardProps) {
  const { course } = enrolment;
  const config = categoryConfig[course.category];
  const Icon = config.icon;

  const isCompleted = enrolment.status === "completed";
  const isInProgress = enrolment.status === "in_progress";

  // Calculate due date status
  let dueStatus: "overdue" | "due_soon" | "on_track" | null = null;
  let daysUntilDue: number | null = null;

  if (enrolment.due_date && !isCompleted) {
    const dueDate = new Date(enrolment.due_date);
    const today = new Date();
    daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      dueStatus = "overdue";
    } else if (daysUntilDue <= 7) {
      dueStatus = "due_soon";
    } else {
      dueStatus = "on_track";
    }
  }

  return (
    <Link href={`/learning/courses/${course.id}`}>
      <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${config.color}`} />
              <CardTitle className="text-base line-clamp-2">{course.title}</CardTitle>
            </div>
            {course.is_required && (
              <Badge variant="destructive" className="shrink-0">Required</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {isCompleted ? (
              <Badge variant="success">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completed
              </Badge>
            ) : isInProgress ? (
              <Badge variant="warning">
                <PlayCircle className="h-3 w-3 mr-1" />
                In Progress
              </Badge>
            ) : (
              <Badge variant="muted">Enrolled</Badge>
            )}
            {dueStatus === "overdue" && (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Overdue
              </Badge>
            )}
            {dueStatus === "due_soon" && (
              <Badge variant="warning">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Due in {daysUntilDue} days
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress bar */}
          {!isCompleted && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{enrolment.progress_percent}%</span>
              </div>
              <Progress value={enrolment.progress_percent} />
            </div>
          )}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(course.duration_minutes)}
            </div>
            <Badge variant="outline" className="text-xs">
              {config.label}
            </Badge>
          </div>
          {!isCompleted && resumeLessonId && (
            <Link
              href={`/learning/courses/${course.id}/lessons/${resumeLessonId}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Resume Learning
            </Link>
          )}
          {isCompleted && (
            <a
              href={`/api/certificate/${course.id}`}
              download
              onClick={(e) => e.stopPropagation()}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              Download Certificate
            </a>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
