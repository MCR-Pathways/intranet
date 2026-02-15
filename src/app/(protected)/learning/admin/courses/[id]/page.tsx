import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CourseEditForm } from "@/components/learning-admin/course-edit-form";
import { LessonManager } from "@/components/learning-admin/lesson-manager";
import { EnrollmentStatsCard } from "@/components/learning-admin/enrollment-stats-card";
import { CourseAssignmentManager } from "@/components/learning-admin/course-assignment-manager";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await getCurrentUser();

  if (!profile?.is_ld_admin) {
    redirect("/learning");
  }

  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, title, description, category, duration_minutes, is_required, thumbnail_url, is_active, content_url, passing_score, due_days_from_start, created_by, created_at, updated_at"
    )
    .eq("id", id)
    .single();

  if (!course) {
    notFound();
  }

  const { data: lessons } = await supabase
    .from("course_lessons")
    .select(
      "id, course_id, title, content, video_url, sort_order, is_active, created_at, updated_at"
    )
    .eq("course_id", id)
    .order("sort_order");

  const { data: enrollments } = await supabase
    .from("course_enrollments")
    .select("id, user_id, status, progress_percent, completed_at, due_date")
    .eq("course_id", id);

  const { data: assignments } = await supabase
    .from("course_assignments")
    .select("id, course_id, assign_type, assign_value, assigned_by, created_at")
    .eq("course_id", id);

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
        <p className="text-muted-foreground">
          Manage course details, lessons, and assignments.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <CourseEditForm course={course} />
          <LessonManager courseId={course.id} lessons={lessons ?? []} />
        </div>
        <div className="space-y-6">
          <EnrollmentStatsCard enrollments={enrollments ?? []} />
          <CourseAssignmentManager
            courseId={course.id}
            assignments={assignments ?? []}
            teams={teams ?? []}
          />
        </div>
      </div>
    </div>
  );
}
