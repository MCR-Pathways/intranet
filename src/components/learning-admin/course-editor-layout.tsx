"use client";

import { useState } from "react";
import { CourseHeader } from "./course-header";
import { CourseSettingsSheet } from "./course-settings-sheet";
import type {
  Course,
  CourseAssignment,
  Team,
} from "@/types/database.types";
import type { PersonOption } from "@/components/hr/person-combobox";

interface CourseEditorLayoutProps {
  course: Course;
  assignments: CourseAssignment[];
  teams: Pick<Team, "id" | "name">[];
  profiles: PersonOption[];
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
  children: React.ReactNode;
}

export function CourseEditorLayout({
  course,
  assignments,
  teams,
  profiles,
  enrolments,
  enrolmentCount,
  creatorName,
  updaterName,
  children,
}: CourseEditorLayoutProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <CourseHeader
        courseId={course.id}
        initialTitle={course.title}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      {/* Content area — full width */}
      {children}

      <CourseSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        course={course}
        assignments={assignments}
        teams={teams}
        profiles={profiles}
        enrolments={enrolments}
        enrolmentCount={enrolmentCount}
        creatorName={creatorName}
        updaterName={updaterName}
      />
    </>
  );
}
