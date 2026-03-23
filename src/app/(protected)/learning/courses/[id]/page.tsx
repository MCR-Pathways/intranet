import { getCurrentUser } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  PlayCircle,
  Calendar,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import type { Course, CourseEnrolment, CourseLesson } from "@/types/database.types";
import { formatDuration } from "@/lib/utils";
import { categoryConfig, getLockedLessonIds, getLockedSectionIds } from "@/lib/learning";
import { EnrollButton } from "./enroll-button";
import { LessonList } from "./lesson-list";
import { SectionAccordion } from "@/components/learning/section-accordion";
import type { LessonType } from "@/types/database.types";

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch course details (only published + active courses visible to learners)
  const { data: courseData, error } = await supabase
    .from("courses")
    .select("id, title, description, category, duration_minutes, is_required, thumbnail_url, content_url, passing_score, due_days_from_start, is_active, status, created_by, updated_by, created_at, updated_at")
    .eq("id", id)
    .eq("is_active", true)
    .eq("status", "published")
    .single();

  if (error || !courseData) {
    notFound();
  }

  const course = courseData as Course;

  // Fetch enrolment, lessons, and sections in parallel
  const [{ data: enrolmentData }, { data: lessonsData }, { data: sectionsData }] =
    await Promise.all([
      supabase
        .from("course_enrolments")
        .select("id, user_id, course_id, status, progress_percent, score, enrolled_at, started_at, completed_at, due_date, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("course_id", id)
        .single(),
      supabase
        .from("course_lessons")
        .select("id, course_id, section_id, title, content, video_url, video_storage_path, lesson_type, passing_score, sort_order, is_active, created_at, updated_at")
        .eq("course_id", id)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("course_sections")
        .select("id, title, description, sort_order")
        .eq("course_id", id)
        .eq("is_active", true)
        .order("sort_order"),
    ]);

  const enrolment = enrolmentData as CourseEnrolment | null;
  const lessons = (lessonsData as CourseLesson[]) ?? [];
  const sections = sectionsData ?? [];
  const hasLessons = lessons.length > 0;
  const hasSections = sections.length > 0;

  // Fetch completions and section quizzes in parallel
  const lessonIds = lessons.map((l) => l.id);
  const sectionIds = sections.map((s) => s.id);

  const [completionsResult, quizzesResult, attemptsResult] = await Promise.all([
    lessonIds.length > 0
      ? supabase
          .from("lesson_completions")
          .select("lesson_id")
          .eq("user_id", user.id)
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: null }),
    sectionIds.length > 0
      ? supabase
          .from("section_quizzes")
          .select("id, section_id")
          .in("section_id", sectionIds)
          .eq("is_active", true)
      : Promise.resolve({ data: null }),
    supabase
      .from("section_quiz_attempts")
      .select("quiz_id, passed")
      .eq("user_id", user.id),
  ]);

  const completedLessonIds =
    completionsResult.data?.map((c: { lesson_id: string }) => c.lesson_id) ?? [];

  // Build section accordion data
  let sectionAccordionData: {
    id: string;
    title: string;
    description: string | null;
    sort_order: number;
    lessons: { id: string; title: string; lesson_type: LessonType; isCompleted: boolean }[];
    hasQuiz: boolean;
    quizPassed: boolean;
    isLocked: boolean;
  }[] = [];

  if (hasSections) {
    const quizzes = quizzesResult.data ?? [];
    const sectionsWithQuizzes = new Set(quizzes.map((q: { section_id: string }) => q.section_id));
    const quizIdToSectionId = new Map(quizzes.map((q: { id: string; section_id: string }) => [q.id, q.section_id]));

    const passedQuizSectionIds = new Set(
      (attemptsResult.data ?? [])
        .filter((a: { passed: boolean }) => a.passed)
        .map((a: { quiz_id: string }) => quizIdToSectionId.get(a.quiz_id))
        .filter((id: string | undefined): id is string => !!id)
    );

    const lockedSectionIds = getLockedSectionIds(
      sections.map((s) => ({ id: s.id, sort_order: s.sort_order })),
      passedQuizSectionIds,
      sectionsWithQuizzes
    );

    // Group lessons by section
    const lessonsBySection = new Map<string, CourseLesson[]>();
    for (const lesson of lessons) {
      if (lesson.section_id) {
        const list = lessonsBySection.get(lesson.section_id) ?? [];
        list.push(lesson);
        lessonsBySection.set(lesson.section_id, list);
      }
    }

    sectionAccordionData = sections.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      sort_order: s.sort_order,
      lessons: (lessonsBySection.get(s.id) ?? []).map((l) => ({
        id: l.id,
        title: l.title,
        lesson_type: (l.lesson_type ?? "text") as LessonType,
        isCompleted: completedLessonIds.includes(l.id),
      })),
      hasQuiz: sectionsWithQuizzes.has(s.id),
      quizPassed: passedQuizSectionIds.has(s.id),
      isLocked: lockedSectionIds.has(s.id),
    }));
  }

  // Fetch sections for section-based courses
  const { data: sectionsData } = await supabase
    .from("course_sections")
    .select("id, title, description, sort_order")
    .eq("course_id", id)
    .eq("is_active", true)
    .order("sort_order");

  const sections = sectionsData ?? [];
  const hasSections = sections.length > 0;

  // For section-based courses: fetch quiz data + attempts
  let sectionAccordionData: {
    id: string;
    title: string;
    description: string | null;
    sort_order: number;
    lessons: { id: string; title: string; lesson_type: LessonType; isCompleted: boolean }[];
    hasQuiz: boolean;
    quizPassed: boolean;
    isLocked: boolean;
  }[] = [];

  if (hasSections) {
    const sectionIds = sections.map((s) => s.id);

    // Fetch section quizzes
    const { data: quizzesData } = await supabase
      .from("section_quizzes")
      .select("id, section_id")
      .in("section_id", sectionIds)
      .eq("is_active", true);

    const quizzes = quizzesData ?? [];
    const sectionsWithQuizzes = new Set(quizzes.map((q) => q.section_id));
    const quizIdToSectionId = new Map(quizzes.map((q) => [q.id, q.section_id]));

    // Fetch quiz attempts to determine passed status
    const { data: attemptsData } = await supabase
      .from("section_quiz_attempts")
      .select("quiz_id, passed")
      .eq("user_id", user.id);

    const passedQuizSectionIds = new Set(
      (attemptsData ?? [])
        .filter((a) => a.passed)
        .map((a) => quizIdToSectionId.get(a.quiz_id))
        .filter((id): id is string => !!id)
    );

    const lockedSectionIds = getLockedSectionIds(
      sections.map((s) => ({ id: s.id, sort_order: s.sort_order })),
      passedQuizSectionIds,
      sectionsWithQuizzes
    );

    // Group lessons by section
    const lessonsBySection = new Map<string, CourseLesson[]>();
    for (const lesson of lessons) {
      if (lesson.section_id) {
        const list = lessonsBySection.get(lesson.section_id) ?? [];
        list.push(lesson);
        lessonsBySection.set(lesson.section_id, list);
      }
    }

    sectionAccordionData = sections.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      sort_order: s.sort_order,
      lessons: (lessonsBySection.get(s.id) ?? []).map((l) => ({
        id: l.id,
        title: l.title,
        lesson_type: (l.lesson_type ?? "text") as LessonType,
        isCompleted: completedLessonIds.includes(l.id),
      })),
      hasQuiz: sectionsWithQuizzes.has(s.id),
      quizPassed: passedQuizSectionIds.has(s.id),
      isLocked: lockedSectionIds.has(s.id),
    }));
  }

  // Find the first incomplete, unlocked lesson for the "Continue Learning" button
  const resumeLessonId = (() => {
    if (!hasLessons) return null;
    const lockedIds = getLockedLessonIds(lessons, completedLessonIds);
    const firstIncomplete = lessons.find(
      (l) => !completedLessonIds.includes(l.id) && !lockedIds.has(l.id)
    );
    return firstIncomplete?.id ?? lessons[0].id;
  })();

  const config = categoryConfig[course.category];
  const Icon = config.icon;

  const isEnrolled = !!enrolment;
  const isCompleted = enrolment?.status === "completed";
  const isInProgress = enrolment?.status === "in_progress";

  // Calculate due date status
  let dueStatus: "overdue" | "due_soon" | "on_track" | null = null;
  let daysUntilDue: number | null = null;

  if (enrolment?.due_date && !isCompleted) {
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
    <div className="space-y-6">
      {/* Course header */}
      <PageHeader
        title={course.title}
        subtitle={course.description ?? undefined}
        breadcrumbs={[
          { label: "Learning", href: "/learning" },
          { label: "Courses", href: "/learning/courses" },
          { label: course.title },
        ]}
      />

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <Icon className={`h-6 w-6 ${config.color}`} />
            </div>
            <Badge variant="outline">{config.label}</Badge>
            {course.is_required && (
              <Badge variant="destructive">Required</Badge>
            )}
          </div>
        </div>

        {/* Action card */}
        <Card className="lg:w-80 shrink-0">
          <CardHeader>
            <CardTitle className="text-lg">
              {isCompleted ? "Course Completed" : isInProgress ? "Continue Learning" : "Get Started"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress bar for enrolled users */}
            {isEnrolled && !isCompleted && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{enrolment.progress_percent}%</span>
                </div>
                <Progress value={enrolment.progress_percent} />
              </div>
            )}

            {/* Due date warning */}
            {dueStatus === "overdue" && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertTriangle className="h-5 w-5" />
                <div className="text-sm">
                  <p className="font-medium">Overdue</p>
                  <p>This course was due {Math.abs(daysUntilDue!)} days ago</p>
                </div>
              </div>
            )}
            {dueStatus === "due_soon" && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-lg">
                <AlertTriangle className="h-5 w-5" />
                <div className="text-sm">
                  <p className="font-medium">Due Soon</p>
                  <p>Complete within {daysUntilDue} days</p>
                </div>
              </div>
            )}

            {/* Completion badge */}
            {isCompleted && (
              <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
                <CheckCircle2 className="h-5 w-5" />
                <div className="text-sm">
                  <p className="font-medium">Completed</p>
                  <p>Finished on {formatDate(enrolment.completed_at)}</p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!isEnrolled ? (
              <EnrollButton courseId={course.id} />
            ) : isCompleted ? (
              <div className="space-y-2">
                {course.content_url && (
                  <Button asChild className="w-full" variant="outline">
                    <a href={course.content_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Review Course
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {hasLessons ? (
                  <Button asChild className="w-full">
                    <Link href={`/learning/courses/${course.id}/lessons/${resumeLessonId}`}>
                      <PlayCircle className="h-4 w-4 mr-2" />
                      {isInProgress ? "Continue Learning" : "Start Learning"}
                    </Link>
                  </Button>
                ) : course.content_url ? (
                  <Button asChild className="w-full">
                    <a href={course.content_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {isInProgress ? "Continue Course" : "Start Course"}
                    </a>
                  </Button>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Course details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Course Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Duration</p>
                <p className="text-sm text-muted-foreground">
                  {formatDuration(course.duration_minutes, "long")}
                </p>
              </div>
            </div>
            {course.passing_score && (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Passing Score</p>
                  <p className="text-sm text-muted-foreground">
                    {course.passing_score}% required to pass
                  </p>
                </div>
              </div>
            )}
            {enrolment?.due_date && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Due Date</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(enrolment.due_date)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {isEnrolled && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <PlayCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Status</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {enrolment.status.replace("_", " ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Enrolled</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(enrolment.enrolled_at)}
                  </p>
                </div>
              </div>
              {enrolment.started_at && (
                <div className="flex items-center gap-3">
                  <PlayCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Started</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(enrolment.started_at)}
                    </p>
                  </div>
                </div>
              )}
              {enrolment.score !== null && (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Score</p>
                    <p className="text-sm text-muted-foreground">
                      {enrolment.score}%
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Course content — sections or flat lesson list */}
      {hasSections ? (
        <SectionAccordion
          courseId={course.id}
          sections={sectionAccordionData}
          isEnrolled={isEnrolled}
        />
      ) : hasLessons ? (
        <LessonList
          courseId={course.id}
          lessons={lessons}
          completedLessonIds={completedLessonIds}
          isEnrolled={isEnrolled}
        />
      ) : null}
    </div>
  );
}
