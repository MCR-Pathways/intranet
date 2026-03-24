import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, isLDAdminEffective } from "@/lib/auth";
import { SectionManager } from "@/components/learning-admin/section-manager";
import { CoursePublishBanner } from "@/components/learning-admin/course-publish-banner";
import { CourseEditorLayout } from "@/components/learning-admin/course-editor-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import type {
  CourseLesson,
  LessonImage,
  CourseSection,
  SectionQuiz,
  SectionQuizQuestion,
  SectionQuizOption,
  SectionQuizQuestionWithOptions,
  CourseSectionWithDetails,
} from "@/types/database.types";

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
      "id, title, description, category, duration_minutes, is_required, thumbnail_url, is_active, status, content_url, passing_score, due_days_from_start, created_by, updated_by, created_at, updated_at"
    )
    .eq("id", id)
    .single();

  if (!course) {
    notFound();
  }

  // Fetch all data in parallel
  const [
    { data: sections },
    { data: lessons },
    { data: enrolments },
    { data: assignments },
    { data: teams },
  ] = await Promise.all([
    supabase
      .from("course_sections")
      .select(
        "id, course_id, title, description, sort_order, is_active, created_at, updated_at"
      )
      .eq("course_id", id)
      .order("sort_order"),
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

  const typedSections = (sections ?? []) as CourseSection[];
  const typedLessons = (lessons ?? []) as CourseLesson[];

  // Fetch section quizzes, questions, and options
  const sectionIds = typedSections.map((s) => s.id);

  const { data: sectionQuizzes } =
    sectionIds.length > 0
      ? await supabase
          .from("section_quizzes")
          .select(
            "id, section_id, title, passing_score, is_active, created_at, updated_at"
          )
          .in("section_id", sectionIds)
      : { data: [] as SectionQuiz[] };

  const typedQuizzes = (sectionQuizzes ?? []) as SectionQuiz[];
  const quizIds = typedQuizzes.map((q) => q.id);

  const { data: sectionQuestions } =
    quizIds.length > 0
      ? await supabase
          .from("section_quiz_questions")
          .select(
            "id, quiz_id, question_text, question_type, sort_order, created_at, updated_at"
          )
          .in("quiz_id", quizIds)
          .order("sort_order")
      : { data: [] as SectionQuizQuestion[] };

  const typedQuestions = (sectionQuestions ?? []) as SectionQuizQuestion[];
  const questionIds = typedQuestions.map((q) => q.id);

  const { data: sectionOptions } =
    questionIds.length > 0
      ? await supabase
          .from("section_quiz_options")
          .select(
            "id, question_id, option_text, is_correct, sort_order, created_at"
          )
          .in("question_id", questionIds)
          .order("sort_order")
      : { data: [] as SectionQuizOption[] };

  const typedOptions = (sectionOptions ?? []) as SectionQuizOption[];

  // Fetch lesson images for text lessons
  const textLessons = typedLessons.filter((l) => l.lesson_type === "text");
  const textLessonIds = textLessons.map((l) => l.id);
  const allLessonImagesMap: Record<string, LessonImage[]> = {};

  if (textLessonIds.length > 0) {
    const { data: allImages } = await supabase
      .from("lesson_images")
      .select(
        "id, lesson_id, file_name, file_url, storage_path, file_size, mime_type, sort_order, created_at"
      )
      .in("lesson_id", textLessonIds)
      .order("sort_order");

    for (const img of allImages ?? []) {
      if (!allLessonImagesMap[img.lesson_id]) {
        allLessonImagesMap[img.lesson_id] = [];
      }
      allLessonImagesMap[img.lesson_id].push(img as LessonImage);
    }
  }

  // ─── Assemble CourseSectionWithDetails[] ──────────────────────

  // Group options by question_id
  const optionsByQuestion = new Map<string, SectionQuizOption[]>();
  for (const opt of typedOptions) {
    const arr = optionsByQuestion.get(opt.question_id) ?? [];
    arr.push(opt);
    optionsByQuestion.set(opt.question_id, arr);
  }

  // Build questions with options, grouped by quiz_id
  const questionsByQuiz = new Map<
    string,
    SectionQuizQuestionWithOptions[]
  >();
  for (const q of typedQuestions) {
    const qWithOpts: SectionQuizQuestionWithOptions = {
      ...q,
      options: optionsByQuestion.get(q.id) ?? [],
    };
    const arr = questionsByQuiz.get(q.quiz_id) ?? [];
    arr.push(qWithOpts);
    questionsByQuiz.set(q.quiz_id, arr);
  }

  // Build quiz map by section_id
  const quizBySection = new Map<string, SectionQuiz>();
  for (const quiz of typedQuizzes) {
    quizBySection.set(quiz.section_id, quiz);
  }

  // Group lessons by section_id
  const lessonsBySection = new Map<string, CourseLesson[]>();
  for (const lesson of typedLessons) {
    if (!lesson.section_id) continue;
    const arr = lessonsBySection.get(lesson.section_id) ?? [];
    arr.push(lesson);
    lessonsBySection.set(lesson.section_id, arr);
  }

  // Assemble sections with details
  const sectionsWithDetails: CourseSectionWithDetails[] = typedSections.map(
    (section) => {
      const sectionLessons = lessonsBySection.get(section.id) ?? [];
      const sectionLessonIds = sectionLessons
        .filter((l) => l.lesson_type === "text")
        .map((l) => l.id);

      // Build lesson images map for this section only
      const sectionImagesMap: Record<string, LessonImage[]> = {};
      for (const lessonId of sectionLessonIds) {
        if (allLessonImagesMap[lessonId]) {
          sectionImagesMap[lessonId] = allLessonImagesMap[lessonId];
        }
      }

      const quiz = quizBySection.get(section.id) ?? null;

      return {
        ...section,
        lessons: sectionLessons,
        quiz,
        quizQuestions: quiz ? (questionsByQuiz.get(quiz.id) ?? []) : [],
        lessonImagesMap: sectionImagesMap,
      };
    }
  );

  // Fetch creator and updater profiles
  const [creatorResult, updaterResult] = await Promise.all([
    course.created_by
      ? supabase
          .from("profiles")
          .select("full_name")
          .eq("id", course.created_by)
          .single()
      : Promise.resolve({ data: null }),
    course.updated_by
      ? supabase
          .from("profiles")
          .select("full_name")
          .eq("id", course.updated_by)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const enrolmentCount = (enrolments ?? []).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title={course.title}
          subtitle="Manage course content and settings."
          breadcrumbs={[
            { label: "Admin", href: "/hr" },
            { label: "Course Management", href: "/learning/admin/courses" },
            { label: course.title },
          ]}
        />
        <Button variant="outline" size="sm" className="shrink-0 mt-2" asChild>
          <Link
            href={`/learning/courses/${course.id}?preview=true`}
            target="_blank"
          >
            <Eye className="h-4 w-4 mr-1.5" />
            Preview as Learner
          </Link>
        </Button>
      </div>

      {/* Draft / Publish banner */}
      <CoursePublishBanner
        courseId={course.id}
        status={course.status as "draft" | "published"}
      />

      {/* Content-first layout: inline title + settings sheet */}
      <CourseEditorLayout
        course={course}
        assignments={assignments ?? []}
        teams={teams ?? []}
        enrolments={enrolments ?? []}
        enrolmentCount={enrolmentCount}
        creatorName={
          course.created_by
            ? (creatorResult.data?.full_name ?? "Unknown")
            : "System"
        }
        updaterName={updaterResult.data?.full_name ?? null}
      >
        {/* Full-width section manager — the primary content */}
        <SectionManager
          courseId={course.id}
          sections={sectionsWithDetails}
        />
      </CourseEditorLayout>
    </div>
  );
}
