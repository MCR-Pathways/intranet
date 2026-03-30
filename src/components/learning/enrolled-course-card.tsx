"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertTriangle } from "lucide-react";
import type { EnrolmentWithCourse } from "@/types/database.types";
import { formatDuration } from "@/lib/utils";
import { categoryConfig } from "@/lib/learning";

interface EnrolledCourseCardProps {
  enrolment: EnrolmentWithCourse;
  now: number;
}

export function EnrolledCourseCard({ enrolment, now }: EnrolledCourseCardProps) {
  const { course } = enrolment;
  const config = categoryConfig[course.category];
  const isCompleted = enrolment.status === "completed";

  // Calculate due date status using server-provided timestamp to avoid hydration mismatches
  let dueStatus: "overdue" | "due_soon" | null = null;
  let daysUntilDue: number | null = null;

  if (enrolment.due_date && !isCompleted) {
    const dueDate = new Date(enrolment.due_date);
    daysUntilDue = Math.ceil(
      (dueDate.getTime() - now) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilDue < 0) {
      dueStatus = "overdue";
    } else if (daysUntilDue <= 7) {
      dueStatus = "due_soon";
    }
  }

  return (
    <Link href={`/learning/courses/${course.id}`}>
      <Card
        className={`border-l-4 ${config.borderColor} shadow-sm overflow-clip rounded-xl transition-shadow hover:shadow-md cursor-pointer h-full`}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-semibold line-clamp-2">
            {course.title}
          </CardTitle>
          {dueStatus && (
            <div className="mt-2">
              {dueStatus === "overdue" ? (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Overdue
                </Badge>
              ) : (
                <Badge variant="warning">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Due in {daysUntilDue}d
                </Badge>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {/* Progress bar — only for in-progress courses */}
          {!isCompleted && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {enrolment.progress_percent}%
                </span>
              </div>
              <Progress value={enrolment.progress_percent} />
            </div>
          )}
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="h-4 w-4 mr-1" />
            {formatDuration(course.duration_minutes)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
