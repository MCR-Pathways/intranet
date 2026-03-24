"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CourseEditForm } from "./course-edit-form";
import { EnrolmentStatsCard } from "./enrolment-stats-card";
import { CourseAssignmentManager } from "./course-assignment-manager";
import { CourseDangerZone } from "./course-danger-zone";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils";
import type { Course, CourseAssignment, Team } from "@/types/database.types";

interface CourseSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course;
  assignments: CourseAssignment[];
  teams: Pick<Team, "id" | "name">[];
  enrolments: {
    id: string;
    status: string;
    progress_percent: number;
    completed_at: string | null;
    due_date: string | null;
  }[];
  enrolmentCount: number;
  creatorName?: string | null;
  updaterName?: string | null;
}

export function CourseSettingsSheet({
  open,
  onOpenChange,
  course,
  assignments,
  teams,
  enrolments,
  enrolmentCount,
  creatorName,
  updaterName,
}: CourseSettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Course Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Course details form (no Card wrapper in sheet mode) */}
          <CourseEditForm course={course} variant="sheet" />

          <Separator />

          {/* Enrolment statistics */}
          <EnrolmentStatsCard enrolments={enrolments} variant="sheet" />

          <Separator />

          {/* Course assignments */}
          <CourseAssignmentManager
            courseId={course.id}
            assignments={assignments}
            teams={teams}
          />

          <Separator />

          {/* Danger zone */}
          <CourseDangerZone
            courseId={course.id}
            courseTitle={course.title}
            isActive={course.is_active}
            status={course.status as "draft" | "published"}
            enrolmentCount={enrolmentCount}
          />

          {/* Metadata footer */}
          <Separator />
          <div className="space-y-1 text-sm text-muted-foreground pb-6">
            <p>
              Created by {creatorName ?? "System"} on{" "}
              {formatDate(new Date(course.created_at))}
            </p>
            {course.updated_by && (
              <p>
                Last modified by {updaterName ?? "Unknown"} on{" "}
                {formatDate(new Date(course.updated_at))}
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
