import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CourseEditForm } from "@/components/learning-admin/course-edit-form";
import { LessonManager } from "@/components/learning-admin/lesson-manager";
import { EnrolmentStatsCard } from "@/components/learning-admin/enrolment-stats-card";
import { CourseAssignmentManager } from "@/components/learning-admin/course-assignment-manager";
import { QuizEditor } from "@/components/learning-admin/quiz-editor";
import { CourseDangerZone } from "@/components/learning-admin/course-danger-zone";
import { CoursePublishBanner } from "@/components/learning-admin/course-publish-banner";
import { Card, CardContent } from "@/components/ui/card";
import type { CourseLesson, QuizQuestionWithOptions, LessonImage } from "@/types/database.types";

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
      "id, title, description, category, duration_minutes, is_required, thumbnail_url, is_active, status, content_url, passing_score, due_days_from_start, created_by, updated_by, created_at, updated_at"
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
        "id, course_id, title, content, video_url, video_storage_path, lesson_type, passing_score, sort_order, is_active, created_at, updated_at"
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

  // Fetch quiz questions and options for all quiz lessons
  const quizLessons = typedLessons.filter((l) => l.lesson_type === "quiz");
  const quizLessonIds = quizLessons.map((l) => l.id);

  const quizQuestionsMap: Record<string, QuizQuestionWithOptions[]> = {};

  if (quizLessonIds.length > 0) {
    const { data: questions } = await supabase
      .from("quiz_questions")
      .select(
        "id, lesson_id, question_text, question_type, sort_order, created_at, updated_at"
      )
      .in("lesson_id", quizLessonIds)
      .order("sort_order");

    if (questions && questions.length > 0) {
      const questionIds = questions.map((q) => q.id);
      const { data: options } = await supabase
        .from("quiz_options")
        .select(
          "id, question_id, option_text, is_correct, sort_order, created_at"
        )
        .in("question_id", questionIds)
        .order("sort_order");

      const allOptions = options ?? [];

      // Group into QuizQuestionWithOptions keyed by lesson_id
      for (const q of questions) {
        const qWithOptions: QuizQuestionWithOptions = {
          ...q,
          options: allOptions.filter((o) => o.question_id === q.id),
        };
        if (!quizQuestionsMap[q.lesson_id]) {
          quizQuestionsMap[q.lesson_id] = [];
        }
        quizQuestionsMap[q.lesson_id].push(qWithOptions);
      }
    }
  }

  // Fetch lesson images for text lessons
  const textLessons = typedLessons.filter((l) => l.lesson_type === "text");
  const textLessonIds = textLessons.map((l) => l.id);
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
        <p className="text-muted-foreground">
          Manage course details, content, and assignments.
        </p>
      </div>

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

          <LessonManager courseId={course.id} lessons={typedLessons} lessonImagesMap={lessonImagesMap} />

          {/* Quiz editors for each quiz lesson */}
          {quizLessons.map((lesson) => (
            <QuizEditor
              key={lesson.id}
              lessonId={lesson.id}
              courseId={course.id}
              lessonTitle={lesson.title}
              questions={quizQuestionsMap[lesson.id] ?? []}
            />
          ))}

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
