import { redirect, notFound } from "next/navigation";
import { getCurrentUser, isLDAdminEffective } from "@/lib/auth";
import { CourseEditForm } from "@/components/learning-admin/course-edit-form";
import { LessonManager } from "@/components/learning-admin/lesson-manager";
import { EnrolmentStatsCard } from "@/components/learning-admin/enrolment-stats-card";
import { CourseAssignmentManager } from "@/components/learning-admin/course-assignment-manager";
import { CourseDangerZone } from "@/components/learning-admin/course-danger-zone";
import { CoursePublishBanner } from "@/components/learning-admin/course-publish-banner";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import type { CourseLesson, LessonImage, CourseSectionWithDetails } from "@/types/database.types";
import { SectionManager } from "@/components/learning-admin/section-manager";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await getCurrentUser();

  if (!isLDAdminEffective(profile)) {
    redirect("/learning");
  }

  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, title, description, category, duration_minutes, is_required, thumbnail_url, is_active, status, content_url, passing_score, due_days_from_start, feedback_avg, feedback_count, created_by, updated_by, created_at, updated_at"
    )
    .eq("id", id)
    .single();

  if (!course) {
    notFound();
  }

  const [
    { data: lessons },
    { data: enrolments },
    { data: assignments },
    { data: teams },
  ] = await Promise.all([
    supabase
      .from("course_lessons")
      .select(
        "id, course_id, section_id, title, content, video_url, video_storage_path, lesson_type, passing_score, sort_order, is_active, created_at, updated_at"
      )
      .eq("course_id", id)
      .order("sort_order"),
    supabase
      .from("course_enrolments")
      .select("id, user_id, status, progress_percent, completed_at, due_date")
      .eq("course_id", id),
    supabase
      .from("course_assignments")
      .select(
        "id, course_id, assign_type, assign_value, assigned_by, created_at"
      )
      .eq("course_id", id),
    supabase.from("teams").select("id, name").order("name"),
  ]);

  const typedLessons = (lessons ?? []) as CourseLesson[];

  // Fetch sections for this course
  const { data: sectionsData } = await supabase
    .from("course_sections")
    .select("id, course_id, title, description, sort_order, is_active, created_at, updated_at")
    .eq("course_id", id)
    .order("sort_order");

  const sections = sectionsData ?? [];
  const sectionIds = sections.map((s) => s.id);
  const hasSections = sectionIds.length > 0;

  // Fetch section quizzes + questions + options
  type SectionQuizWithQuestions = CourseSectionWithDetails["quiz"];
  const sectionQuizMap: Record<string, NonNullable<SectionQuizWithQuestions>> = {};

  if (hasSections) {
    const { data: quizzes } = await supabase
      .from("section_quizzes")
      .select("id, section_id, title, passing_score, is_active, created_at, updated_at")
      .in("section_id", sectionIds);

    if (quizzes && quizzes.length > 0) {
      const quizIds = quizzes.map((q) => q.id);
      const { data: questions } = await supabase
        .from("section_quiz_questions")
        .select("id, quiz_id, question_text, question_type, sort_order, created_at, updated_at")
        .in("quiz_id", quizIds)
        .order("sort_order");

      const questionIds = (questions ?? []).map((q) => q.id);
      let allOptions: { id: string; question_id: string; option_text: string; is_correct: boolean; sort_order: number; created_at: string }[] = [];

      if (questionIds.length > 0) {
        const { data: opts } = await supabase
          .from("section_quiz_options")
          .select("id, question_id, option_text, is_correct, sort_order, created_at")
          .in("question_id", questionIds)
          .order("sort_order");
        allOptions = opts ?? [];
      }

      for (const quiz of quizzes) {
        const quizQuestions = (questions ?? [])
          .filter((q) => q.quiz_id === quiz.id)
          .map((q) => ({
            ...q,
            options: allOptions.filter((o) => o.question_id === q.id),
          }));

        sectionQuizMap[quiz.section_id] = {
          ...quiz,
          questions: quizQuestions as NonNullable<SectionQuizWithQuestions>["questions"],
        } as NonNullable<SectionQuizWithQuestions>;
      }
    }
  }

  // Build CourseSectionWithDetails array
  const sectionsWithDetails: CourseSectionWithDetails[] = sections.map((s) => ({
    ...s,
    lessons: typedLessons.filter((l) => l.section_id === s.id).sort((a, b) => a.sort_order - b.sort_order),
    quiz: sectionQuizMap[s.id] ?? null,
  }));

  // Lessons without a section (legacy or unsectioned)
  const unsectionedLessons = typedLessons.filter((l) => !l.section_id);

  // Fetch lesson images for text lessons
  const textLessonIds = typedLessons.filter((l) => l.lesson_type === "text").map((l) => l.id);
  const lessonImagesMap: Record<string, LessonImage[]> = {};

  if (textLessonIds.length > 0) {
    const { data: allImages } = await supabase
      .from("lesson_images")
      .select("id, lesson_id, file_name, file_url, storage_path, file_size, mime_type, sort_order, created_at")
      .in("lesson_id", textLessonIds)
      .order("sort_order");

    for (const img of allImages ?? []) {
      if (!lessonImagesMap[img.lesson_id]) {
        lessonImagesMap[img.lesson_id] = [];
      }
      lessonImagesMap[img.lesson_id].push(img as LessonImage);
    }
  }

  // Fetch creator and updater profiles
  const [creatorResult, updaterResult] = await Promise.all([
    course.created_by
      ? supabase.from("profiles").select("full_name").eq("id", course.created_by).single()
      : Promise.resolve({ data: null }),
    course.updated_by
      ? supabase.from("profiles").select("full_name").eq("id", course.updated_by).single()
      : Promise.resolve({ data: null }),
  ]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const enrolmentCount = (enrolments ?? []).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={course.title}
        subtitle="Manage course details, content, and assignments."
        breadcrumbs={[
          { label: "Admin", href: "/hr" },
          { label: "Course Management", href: "/learning/admin/courses" },
          { label: course.title },
        ]}
      />

      {/* Draft / Publish banner */}
      <CoursePublishBanner
        courseId={course.id}
        status={course.status as "draft" | "published"}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <CourseEditForm course={course} />

          {/* Course metadata */}
          <Card>
            <CardContent className="pt-6 space-y-1 text-sm text-muted-foreground">
              <p>
                Created by{" "}
                {course.created_by
                  ? (creatorResult.data?.full_name ?? "Unknown")
                  : "System"}{" "}
                on{" "}
                {formatDate(course.created_at)}
              </p>
              {course.updated_by && (
                <p>
                  Last modified by {updaterResult.data?.full_name ?? "Unknown"} on{" "}
                  {formatDate(course.updated_at)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Section-based course content */}
          {hasSections ? (
            <SectionManager
              courseId={course.id}
              sections={sectionsWithDetails}
              lessonImagesMap={lessonImagesMap}
            />
          ) : (
            <LessonManager courseId={course.id} lessons={unsectionedLessons} lessonImagesMap={lessonImagesMap} />
          )}

          <CourseDangerZone
            courseId={course.id}
            courseTitle={course.title}
            isActive={course.is_active}
            status={course.status as "draft" | "published"}
            enrolmentCount={enrolmentCount}
          />
        </div>
        <div className="space-y-6">
          <EnrolmentStatsCard enrolments={enrolments ?? []} />
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
