import { getCurrentUser } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  CourseLesson,
  LessonType,
  QuizQuestionWithOptions,
  QuizAttempt,
  QuizOption,
} from "@/types/database.types";
import { MarkCompleteButton } from "./mark-complete-button";
import { VideoPlayer } from "@/components/learning/video-player";
import { QuizPlayer } from "@/components/learning/quiz-player";
import { LessonSidebar } from "@/components/learning/lesson-sidebar";
import { getLockedLessonIds } from "@/lib/learning";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id: courseId, lessonId } = await params;
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the course (only published + active)
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, is_active, status")
    .eq("id", courseId)
    .eq("is_active", true)
    .eq("status", "published")
    .single();

  if (!course) {
    notFound();
  }

  // Check enrollment
  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .single();

  if (!enrollment) {
    redirect(`/learning/courses/${courseId}`);
  }

  // Fetch all active lessons for navigation and sidebar
  const { data: allLessons } = await supabase
    .from("course_lessons")
    .select(
      "id, course_id, title, content, video_url, video_storage_path, lesson_type, passing_score, sort_order, is_active, created_at, updated_at"
    )
    .eq("course_id", courseId)
    .eq("is_active", true)
    .order("sort_order");

  const lessons = (allLessons as CourseLesson[]) ?? [];
  const currentIndex = lessons.findIndex((l) => l.id === lessonId);

  if (currentIndex === -1) {
    notFound();
  }

  const lesson = lessons[currentIndex];
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

  // Fetch all lesson completions for sidebar + current lesson check
  const lessonIds = lessons.map((l) => l.id);
  let completedLessonIds: string[] = [];
  if (lessonIds.length > 0) {
    const { data: completions } = await supabase
      .from("lesson_completions")
      .select("lesson_id")
      .eq("user_id", user.id)
      .in("lesson_id", lessonIds);
    completedLessonIds = completions?.map((c) => c.lesson_id) ?? [];
  }

  const isCompleted = completedLessonIds.includes(lessonId);

  // Determine which lessons are locked by unpassed quizzes
  const lockedLessonIds = getLockedLessonIds(lessons, completedLessonIds);
  const isLastLesson = !nextLesson;

  // If the current lesson is locked, redirect to the course page
  if (lockedLessonIds.has(lessonId)) {
    redirect(`/learning/courses/${courseId}`);
  }

  // Build sidebar items
  const sidebarLessons = lessons.map((l) => ({
    id: l.id,
    title: l.title,
    lesson_type: (l.lesson_type ?? "text") as LessonType,
    sort_order: l.sort_order,
    isCompleted: completedLessonIds.includes(l.id),
    isLocked: lockedLessonIds.has(l.id),
  }));

  // For quiz lessons: fetch questions with options (strip is_correct) and past attempts
  let quizQuestions: QuizQuestionWithOptions[] = [];
  let quizAttempts: QuizAttempt[] = [];

  if (lesson.lesson_type === "quiz") {
    const [questionsResult, attemptsResult] = await Promise.all([
      supabase
        .from("quiz_questions")
        .select(
          "id, lesson_id, question_text, question_type, sort_order, created_at, updated_at"
        )
        .eq("lesson_id", lessonId)
        .order("sort_order"),
      supabase
        .from("quiz_attempts")
        .select(
          "id, user_id, lesson_id, score, passed, answers, attempted_at"
        )
        .eq("user_id", user.id)
        .eq("lesson_id", lessonId)
        .order("attempted_at", { ascending: false }),
    ]);

    const questions = questionsResult.data ?? [];
    quizAttempts = (attemptsResult.data as QuizAttempt[]) ?? [];

    // Fetch options for all questions (strip is_correct for security)
    if (questions.length > 0) {
      const questionIds = questions.map((q) => q.id);
      const { data: optionsData } = await supabase
        .from("quiz_options")
        .select("id, question_id, option_text, is_correct, sort_order, created_at")
        .in("question_id", questionIds)
        .order("sort_order");

      const options = optionsData ?? [];

      // Group options by question and strip is_correct
      quizQuestions = questions.map((q) => ({
        ...q,
        options: options
          .filter((o) => o.question_id === q.id)
          .map(
            (o) =>
              ({
                ...o,
                is_correct: false, // Stripped for security — scoring happens server-side
              }) as QuizOption
          ),
      }));
    }
  }

  // For text lessons: fetch images
  let lessonImages: { id: string; file_url: string; file_name: string }[] = [];
  if (lesson.lesson_type === "text") {
    const { data: imgData } = await supabase
      .from("lesson_images")
      .select("id, file_url, file_name")
      .eq("lesson_id", lessonId)
      .order("sort_order");
    lessonImages = imgData ?? [];
  }

  // For uploaded videos: get the public URL
  let storagePublicUrl: string | null = null;
  if (lesson.lesson_type === "video" && lesson.video_storage_path) {
    const { data: urlData } = supabase.storage
      .from("course-videos")
      .getPublicUrl(lesson.video_storage_path);
    storagePublicUrl = urlData?.publicUrl ?? null;
  }

  const lessonType = (lesson.lesson_type ?? "text") as LessonType;

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <LessonSidebar
        courseId={courseId}
        courseTitle={course.title}
        lessons={sidebarLessons}
        currentLessonId={lessonId}
      />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Lesson {currentIndex + 1} of {lessons.length}
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            {lesson.title}
          </h1>

          {/* Content by lesson type */}
          {lessonType === "video" && (
            <VideoPlayer
              videoStoragePath={lesson.video_storage_path ?? null}
              videoUrl={lesson.video_url ?? null}
              lessonId={lessonId}
              courseId={courseId}
              isCompleted={isCompleted}
              storagePublicUrl={storagePublicUrl}
              isLastLesson={isLastLesson}
            />
          )}

          {lessonType === "text" && (
            <Card>
              <CardContent className="pt-6">
                {lesson.content ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                    {lesson.content}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No content has been added to this lesson yet.
                  </p>
                )}
                {lessonImages.length > 0 && (
                  <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2">
                    {lessonImages.map((img) => (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        key={img.id}
                        src={img.file_url}
                        alt={img.file_name}
                        className="rounded-lg border border-border w-full object-contain"
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {lessonType === "quiz" && (
            <QuizPlayer
              lessonId={lessonId}
              courseId={courseId}
              questions={quizQuestions}
              passingScore={lesson.passing_score ?? 80}
              previousAttempts={quizAttempts}
              isCompleted={isCompleted}
              isLastLesson={isLastLesson}
            />
          )}

          {/* Mark Complete + Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              {prevLesson ? (
                <Button variant="outline" asChild>
                  <Link
                    href={`/learning/courses/${courseId}/lessons/${prevLesson.id}`}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Link>
                </Button>
              ) : (
                <div />
              )}
            </div>

            <MarkCompleteButton
              lessonId={lessonId}
              courseId={courseId}
              isCompleted={isCompleted}
              lessonType={lessonType}
              hasUploadedVideo={
                lessonType === "video" && !!lesson.video_storage_path
              }
            />

            <div>
              {nextLesson && !lockedLessonIds.has(nextLesson.id) ? (
                <Button variant="outline" asChild>
                  <Link
                    href={`/learning/courses/${courseId}/lessons/${nextLesson.id}`}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link href={`/learning/courses/${courseId}`}>
                    Back to Course
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
