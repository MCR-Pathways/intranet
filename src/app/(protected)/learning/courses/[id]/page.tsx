import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  PlayCircle,
  Calendar,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import type { Course, CourseEnrollment, CourseLesson } from "@/types/database.types";
import { formatDuration } from "@/lib/utils";
import { categoryConfig, getLockedLessonIds } from "@/lib/learning";
import { EnrollButton } from "./enroll-button";
import { LessonList } from "./lesson-list";

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
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch course details
  const { data: courseData, error } = await supabase
    .from("courses")
    .select("id, title, description, category, duration_minutes, is_required, thumbnail_url, content_url, passing_score, due_days_from_start, is_active, created_by, created_at, updated_at")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !courseData) {
    notFound();
  }

  const course = courseData as Course;

  // Fetch user's enrollment for this course
  const { data: enrollmentData } = await supabase
    .from("course_enrollments")
    .select("id, user_id, course_id, status, progress_percent, score, enrolled_at, started_at, completed_at, due_date, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("course_id", id)
    .single();

  const enrollment = enrollmentData as CourseEnrollment | null;

  // Fetch lessons for this course
  const { data: lessonsData } = await supabase
    .from("course_lessons")
    .select("id, course_id, title, content, video_url, video_storage_path, lesson_type, passing_score, sort_order, is_active, created_at, updated_at")
    .eq("course_id", id)
    .eq("is_active", true)
    .order("sort_order");

  const lessons = (lessonsData as CourseLesson[]) ?? [];

  // Fetch user's lesson completions if they have lessons
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

  const hasLessons = lessons.length > 0;

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

  const isEnrolled = !!enrollment;
  const isCompleted = enrollment?.status === "completed";
  const isInProgress = enrollment?.status === "in_progress";

  // Calculate due date status
  let dueStatus: "overdue" | "due_soon" | "on_track" | null = null;
  let daysUntilDue: number | null = null;

  if (enrollment?.due_date && !isCompleted) {
    const dueDate = new Date(enrollment.due_date);
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
      {/* Back navigation */}
      <Button variant="ghost" asChild className="mb-4">
        <Link href="/learning/courses">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Course Catalog
        </Link>
      </Button>

      {/* Course header */}
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
          <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {course.description}
          </p>
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
                  <span className="font-medium">{enrollment.progress_percent}%</span>
                </div>
                <Progress value={enrollment.progress_percent} />
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
                  <p>Finished on {formatDate(enrollment.completed_at)}</p>
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
            {enrollment?.due_date && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Due Date</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(enrollment.due_date)}
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
                    {enrollment.status.replace("_", " ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Enrolled</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(enrollment.enrolled_at)}
                  </p>
                </div>
              </div>
              {enrollment.started_at && (
                <div className="flex items-center gap-3">
                  <PlayCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Started</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(enrollment.started_at)}
                    </p>
                  </div>
                </div>
              )}
              {enrollment.score !== null && (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Score</p>
                    <p className="text-sm text-muted-foreground">
                      {enrollment.score}%
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Lessons section */}
      {hasLessons && (
        <LessonList
          courseId={course.id}
          lessons={lessons}
          completedLessonIds={completedLessonIds}
          isEnrolled={isEnrolled}
        />
      )}
    </div>
  );
}
