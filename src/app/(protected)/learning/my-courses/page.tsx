import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  PlayCircle,
  AlertTriangle,
  GraduationCap,
  BookOpen,
  Globe,
} from "lucide-react";
import type { EnrolmentWithCourse, ExternalCourse } from "@/types/database.types";
import { ExternalCourseDialog } from "@/components/learning/external-course-dialog";
import { ExternalCourseCard } from "@/components/learning/external-course-card";
import { EnrolledCourseCard } from "@/components/learning/enrolled-course-card";

export default async function MyCoursesPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user's enrolments with course details + external courses
  const [{ data: enrolments }, { data: externalCoursesData }] = await Promise.all([
    supabase
      .from("course_enrolments")
      .select(`
        id, user_id, course_id, status, progress_percent, score, enrolled_at, started_at, completed_at, due_date, created_at, updated_at,
        course:courses(id, title, description, category, duration_minutes, is_required, thumbnail_url, content_url, passing_score, due_days_from_start, is_active, created_by, updated_by, created_at, updated_at)
      `)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("external_courses")
      .select("id, user_id, title, provider, category, completed_at, duration_minutes, certificate_url, notes, created_at, updated_at")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false }),
  ]);

  const externalCourses = (externalCoursesData ?? []) as ExternalCourse[];

  // Filter and type cast enrolments
  const typedEnrolments = (enrolments || [])
    .filter((e) => e.course)
    .map((e) => ({
      ...e,
      course: e.course as unknown as EnrolmentWithCourse["course"],
    })) as EnrolmentWithCourse[];

  // Categorize enrolments
  const inProgressCourses = typedEnrolments.filter(
    (e) => e.status === "in_progress" || e.status === "enrolled"
  );
  const completedCourses = typedEnrolments.filter(
    (e) => e.status === "completed"
  );

  // Fetch lesson data for in-progress courses to compute "Resume" links
  const inProgressCourseIds = inProgressCourses.map((e) => e.course_id);
  let resumeLessonMap = new Map<string, string>();

  if (inProgressCourseIds.length > 0) {
    const [{ data: allLessons }, { data: allCompletions }] = await Promise.all([
      supabase
        .from("course_lessons")
        .select("id, course_id, sort_order")
        .in("course_id", inProgressCourseIds)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("lesson_completions")
        .select("lesson_id")
        .eq("user_id", user.id),
    ]);

    const completedSet = new Set((allCompletions ?? []).map((c) => c.lesson_id));

    // Group lessons by course and find the first incomplete one
    const lessonsByCourse = new Map<string, { id: string; sort_order: number }[]>();
    for (const l of allLessons ?? []) {
      const list = lessonsByCourse.get(l.course_id) ?? [];
      list.push({ id: l.id, sort_order: l.sort_order });
      lessonsByCourse.set(l.course_id, list);
    }

    for (const [courseId, lessons] of lessonsByCourse) {
      const firstIncomplete = lessons.find((l) => !completedSet.has(l.id));
      if (firstIncomplete) {
        resumeLessonMap.set(courseId, firstIncomplete.id);
      }
      // If all lessons are complete, don't set a resume link — the card
      // will simply not show "Resume Learning", avoiding confusion.
    }
  }

  // Count overdue and due soon
  const now = Date.now(); // eslint-disable-line react-hooks/purity -- server component runs once per request

  const overdueCourses = inProgressCourses.filter((e) => {
    if (!e.due_date) return false;
    const daysUntilDue = Math.ceil(
      (new Date(e.due_date).getTime() - now) / (1000 * 60 * 60 * 24)
    );
    return daysUntilDue < 0;
  });

  const dueSoonCourses = inProgressCourses.filter((e) => {
    if (!e.due_date) return false;
    const daysUntilDue = Math.ceil(
      (new Date(e.due_date).getTime() - now) / (1000 * 60 * 60 * 24)
    );
    return daysUntilDue >= 0 && daysUntilDue <= 7;
  });

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Button variant="ghost" asChild className="mb-4">
        <Link href="/learning">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Learning
        </Link>
      </Button>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Courses</h1>
          <p className="text-muted-foreground mt-1">
            Track your learning progress
          </p>
        </div>
        <Button asChild>
          <Link href="/learning/courses">
            <BookOpen className="h-4 w-4 mr-2" />
            Browse Catalogue
          </Link>
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Enrolled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{typedEnrolments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{inProgressCourses.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{completedCourses.length}</p>
          </CardContent>
        </Card>
        <Card className={overdueCourses.length > 0 ? "border-destructive" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${overdueCourses.length > 0 ? "text-destructive" : ""}`}>
              {overdueCourses.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert for overdue courses */}
      {overdueCourses.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-lg text-destructive">Action Required</CardTitle>
            </div>
            <CardDescription className="text-destructive/80">
              You have {overdueCourses.length} overdue course{overdueCourses.length > 1 ? "s" : ""} that need{overdueCourses.length === 1 ? "s" : ""} to be completed immediately.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Alert for due soon courses */}
      {dueSoonCourses.length > 0 && overdueCourses.length === 0 && (
        <Card className="border-mcr-orange bg-mcr-orange/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-mcr-orange" />
              <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
            </div>
            <CardDescription>
              You have {dueSoonCourses.length} course{dueSoonCourses.length > 1 ? "s" : ""} due within the next 7 days.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Course tabs */}
      <Tabs defaultValue="in_progress" className="w-full">
        <TabsList variant="line">
          <TabsTrigger value="in_progress">
            In Progress ({inProgressCourses.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedCourses.length})
          </TabsTrigger>
          <TabsTrigger value="external">
            External Learning ({externalCourses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="in_progress" className="mt-6">
          {inProgressCourses.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {inProgressCourses.map((enrolment) => (
                <EnrolledCourseCard key={enrolment.id} enrolment={enrolment} resumeLessonId={resumeLessonMap.get(enrolment.course_id)} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <PlayCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center mb-4">
                  You don&apos;t have any courses in progress.
                </p>
                <Button asChild>
                  <Link href="/learning/courses">Browse Course Catalogue</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {completedCourses.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedCourses.map((enrolment) => (
                <EnrolledCourseCard key={enrolment.id} enrolment={enrolment} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  You haven&apos;t completed any courses yet.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="external" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Log courses completed outside the platform to keep a record of all your learning.
              </p>
              <ExternalCourseDialog mode="create" />
            </div>

            {externalCourses.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {externalCourses.map((course) => (
                  <ExternalCourseCard key={course.id} course={course} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center mb-4">
                    No external courses logged yet.
                  </p>
                  <ExternalCourseDialog mode="create" />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
