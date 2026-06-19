import { getCurrentUser } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getPreviewMode } from "@/lib/learning";
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
  Award,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import type { Course, CourseEnrolment, CourseLesson } from "@/types/database.types";
import { formatDuration } from "@/lib/utils";
import { getCategoryConfig, getLockedLessonIds, getLockedSectionIds, getDueStatus } from "@/lib/learning";
import { EnrollButton } from "./enroll-button";
import { HubCoursePlayer } from "./hub-course-player";
import { getHubCourseContent } from "@/lib/chat-content/queries";
import { LessonList } from "./lesson-list";
import { SectionAccordion } from "@/components/learning/section-accordion";
import { PreviewModeBanner } from "@/components/learning/preview-mode-banner";
import { CompletionCelebration } from "@/components/learning/completion-celebration";
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const { supabase, user, profile } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { isPreview } = getPreviewMode(
    resolvedSearchParams,
    profile
  );

  // Fetch course details — preview mode bypasses published+active filters
  let query = supabase
    .from("courses")
    .select("id, title, description, category, duration_minutes, is_required, thumbnail_url, content_url, passing_score, due_days_from_start, is_active, status, issue_certificate, created_by, updated_by, created_at, updated_at, source, source_course_id")
    .eq("id", id);

  if (!isPreview) {
    query = query.eq("is_active", true).eq("status", "published");
  }

  const { data: courseData, error } = await query.single();

  if (error || !courseData) {
    notFound();
  }

  const course = courseData as Course;

  // Hub courses (published from the LMS hub) render the ported course player
  // against content read live from the Chat project, and track completion
  // natively. They have no course_sections/course_lessons, so they branch out
  // of the native section/lesson/quiz flow entirely.
  if (course.source === "hub") {
    if (!course.source_course_id) {
      notFound();
    }

    const [{ data: hubEnrolment }, { data: hubCertificate }, hubContent] =
      await Promise.all([
        supabase
          .from("course_enrolments")
          .select("status")
          .eq("user_id", user.id)
          .eq("course_id", id)
          .maybeSingle(),
        supabase
          .from("certificates")
          .select("id")
          .eq("user_id", user.id)
          .eq("course_id", id)
          .maybeSingle(),
        getHubCourseContent(course.source_course_id),
      ]);

    const hubCategory = getCategoryConfig(course.category);
    const HubIcon = hubCategory.icon;

    return (
      <div className="space-y-6">
        {isPreview && <PreviewModeBanner courseId={id} />}

        <PageHeader
          title={course.title}
          subtitle={course.description ?? undefined}
          breadcrumbs={[
            { label: "Learning", href: "/learning" },
            { label: "Courses", href: "/learning/courses" },
            { label: course.title },
          ]}
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className={`rounded-lg p-2 ${hubCategory.bgColor}`}>
            <HubIcon className={`h-6 w-6 ${hubCategory.color}`} />
          </div>
          <Badge variant="outline">{hubCategory.label}</Badge>
          {course.is_required && <Badge variant="destructive">Required</Badge>}
          {course.duration_minutes ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {formatDuration(course.duration_minutes)}
            </span>
          ) : null}
        </div>

        {hubCertificate?.id && (
          <Card className="border-mcr-green/30 bg-mcr-green/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <span className="flex items-center gap-2 font-medium text-foreground">
                <Award className="h-5 w-5 text-mcr-green" />
                You have completed this course.
              </span>
              <Button asChild variant="outline" size="sm">
                <Link href={`/api/certificate/${user.id}`} target="_blank">
                  <Award />
                  View certificate
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {hubContent ? (
          <HubCoursePlayer
            content={hubContent}
            courseId={id}
            initialStatus={hubEnrolment?.status ?? null}
            isPreview={isPreview}
          />
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              This course&rsquo;s content is temporarily unavailable. Please try
              again shortly.
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Fetch enrolment, lessons, sections, and certificate in parallel
  const [{ data: enrolmentData }, { data: lessonsData }, { data: sectionsData }, { data: certificateData }] =
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
      supabase
        .from("certificates")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", id)
        .single(),
    ]);

  const enrolment = enrolmentData as CourseEnrolment | null;
  const lessons = (lessonsData as CourseLesson[]) ?? [];
  const sections = sectionsData ?? [];
  const hasLessons = lessons.length > 0;
  const hasSections = sections.length > 0;
  const hasCertificate = !!certificateData?.id;
  const courseIssuesCertificate = (course as Course & { issue_certificate?: boolean }).issue_certificate !== false;

  const isEnrolled = !!enrolment;
  const sectionIds = sections.map((s) => s.id);

  // Always fetch which sections have quizzes (needed for both enrolled accordion AND unenrolled preview)
  const { data: quizzesData } = sectionIds.length > 0
    ? await supabase
        .from("section_quizzes")
        .select("id, section_id")
        .in("section_id", sectionIds)
        .eq("is_active", true)
    : { data: null };

  const quizzes = quizzesData ?? [];
  const sectionsWithQuizzes = new Set(quizzes.map((q: { section_id: string }) => q.section_id));

  // Only fetch completions, attempts, and build full accordion data for enrolled users
  let completedLessonIds: string[] = [];
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

  if (isEnrolled && hasLessons) {
    const lessonIds = lessons.map((l) => l.id);

    const [completionsResult, attemptsResult] = await Promise.all([
      supabase
        .from("lesson_completions")
        .select("lesson_id")
        .eq("user_id", user.id)
        .in("lesson_id", lessonIds),
      hasSections
        ? supabase
            .from("section_quiz_attempts")
            .select("quiz_id, passed")
            .eq("user_id", user.id)
        : Promise.resolve({ data: null }),
    ]);

    completedLessonIds =
      completionsResult.data?.map((c: { lesson_id: string }) => c.lesson_id) ?? [];

    // Build section accordion data only for section-based courses
    if (hasSections) {
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

  const config = getCategoryConfig(course.category);
  const Icon = config.icon;

  const isCompleted = enrolment?.status === "completed";
  const isInProgress = enrolment?.status === "in_progress";
  const showCelebration = resolvedSearchParams.completed === "true" && isCompleted;

  // Due-date status (server component, so the time read runs once on the server)
  const { status: dueStatus, daysUntilDue } =
    enrolment?.due_date && !isCompleted
      ? getDueStatus(new Date(enrolment.due_date), new Date().getTime())
      : { status: null, daysUntilDue: 0 };

  return (
    <div className="space-y-6">
      {isPreview && <PreviewModeBanner courseId={id} />}

      {/* Completion celebration */}
      {showCelebration && (
        <CompletionCelebration
          courseTitle={course.title}
          courseId={course.id}
        />
      )}

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
                  <p>This course was due {daysUntilDue === 0 ? "today" : `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"} ago`}</p>
                </div>
              </div>
            )}
            {dueStatus === "due_soon" && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-lg">
                <AlertTriangle className="h-5 w-5" />
                <div className="text-sm">
                  <p className="font-medium">Due Soon</p>
                  <p>Complete within {daysUntilDue} day{daysUntilDue === 1 ? "" : "s"}</p>
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
              <EnrollButton courseId={course.id} hasLessons={hasLessons} />
            ) : isCompleted ? (
              <div className="space-y-2">
                {hasCertificate && courseIssuesCertificate && (
                  <Button asChild className="w-full">
                    <a href={`/api/certificate/${course.id}`} download>
                      <Award />
                      Download Certificate
                    </a>
                  </Button>
                )}
                {course.content_url && (
                  <Button asChild className="w-full" variant="outline">
                    <a href={course.content_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink />
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
                      <PlayCircle />
                      {isInProgress ? "Continue Learning" : "Start Learning"}
                    </Link>
                  </Button>
                ) : course.content_url ? (
                  <Button asChild className="w-full">
                    <a href={course.content_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink />
                      {isInProgress ? "Continue Course" : "Start Course"}
                    </a>
                  </Button>
                ) : null}
              </div>
            )}
            {/* Compact course info */}
            <div className="border-t border-border pt-3 space-y-2 text-sm text-muted-foreground">
              {course.duration_minutes && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(course.duration_minutes, "long")}</span>
                </div>
              )}
              {course.passing_score && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{course.passing_score}% to pass</span>
                </div>
              )}
              {/* On track: has a due date, not completed, and no overdue/due-soon warning (getDueStatus returns null past 7 days). */}
              {enrolment?.due_date && !isCompleted && dueStatus === null && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Due {formatDate(enrolment.due_date)}</span>
                </div>
              )}
              {isEnrolled && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Enrolled {formatDate(enrolment.enrolled_at)}</span>
                </div>
              )}
              {enrolment?.score != null && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Score: {enrolment.score}%</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Course content — interactive for enrolled, preview for unenrolled */}
      {isEnrolled ? (
        hasSections ? (
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
        ) : null
      ) : (hasLessons || hasSections) ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              Course content
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasSections ? (
              <ul className="space-y-2">
                {sections.map((section) => {
                  const sectionLessonCount = lessons.filter(
                    (l) => l.section_id === section.id
                  ).length;
                  const sectionHasQuiz = sectionsWithQuizzes.has(section.id);
                  return (
                    <li
                      key={section.id}
                      className="flex items-start justify-between py-2 border-b border-border last:border-b-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{section.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {sectionLessonCount}{" "}
                          {sectionLessonCount === 1 ? "lesson" : "lessons"}
                          {sectionHasQuiz && (
                            <span className="inline-flex items-center gap-1 ml-2">
                              <HelpCircle className="h-3 w-3" />
                              Includes quiz
                            </span>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
                {course.duration_minutes
                  ? ` · ${formatDuration(course.duration_minutes, "long")}`
                  : ""}
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
