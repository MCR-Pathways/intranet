import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import {
  GraduationCap,
  Shield,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  PlayCircle,
  CheckCircle2,
  Globe,
} from "lucide-react";
import type { EnrolmentWithCourse, ExternalCourse } from "@/types/database.types";
import { EnrolledCourseCard } from "@/components/learning/enrolled-course-card";
import { ExternalCourseDialog } from "@/components/learning/external-course-dialog";
import { ExternalCourseCard } from "@/components/learning/external-course-card";

export default async function LearningPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch courses, enrolments, and external courses in parallel
  const [{ data: courses }, { data: enrolments }, { data: externalCoursesData }] =
    await Promise.all([
      supabase
        .from("courses")
        .select(
          "id, title, description, category, duration_minutes, is_required, thumbnail_url, content_url, passing_score, due_days_from_start, is_active, status, created_by, updated_by, created_at, updated_at"
        )
        .eq("is_active", true)
        .eq("status", "published"),
      supabase
        .from("course_enrolments")
        .select(
          `
        id, user_id, course_id, status, progress_percent, score, enrolled_at, started_at, completed_at, due_date, created_at, updated_at,
        course:courses(id, title, description, category, duration_minutes, is_required, thumbnail_url, content_url, passing_score, due_days_from_start, is_active, created_by, updated_by, created_at, updated_at)
      `
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("external_courses")
        .select(
          "id, user_id, title, provider, category, completed_at, duration_minutes, certificate_url, notes, created_at, updated_at"
        )
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false }),
    ]);

  const externalCourses = (externalCoursesData ?? []) as ExternalCourse[];

  // Type and filter enrolments — only show enrolments for published, active courses
  const typedEnrolments = (enrolments || [])
    .filter((e) => {
      if (!e.course) return false;
      const c = e.course as unknown as EnrolmentWithCourse["course"];
      return c.is_active;
    })
    .map((e) => ({
      ...e,
      course: e.course as unknown as EnrolmentWithCourse["course"],
    })) as EnrolmentWithCourse[];

  // Get enrolment map for compliance stats
  const enrolmentMap = new Map(
    typedEnrolments.map((e) => [e.course_id, e])
  );

  const now = Date.now(); // eslint-disable-line react-hooks/purity -- server component runs once per request

  // Compliance stats
  const complianceCourses =
    courses?.filter((c) => c.category === "compliance") || [];
  const complianceStats = {
    total: complianceCourses.length,
    completed: complianceCourses.filter(
      (c) => enrolmentMap.get(c.id)?.status === "completed"
    ).length,
    overdue: complianceCourses.filter((c) => {
      const enrolment = enrolmentMap.get(c.id);
      if (!enrolment?.due_date || enrolment.status === "completed") return false;
      return (
        Math.ceil(
          (new Date(enrolment.due_date).getTime() - now) / (1000 * 60 * 60 * 24)
        ) < 0
      );
    }).length,
    dueSoon: complianceCourses.filter((c) => {
      const enrolment = enrolmentMap.get(c.id);
      if (!enrolment || enrolment.status === "completed") return false;
      if (!enrolment.due_date) return c.is_required;
      const daysUntilDue = Math.ceil(
        (new Date(enrolment.due_date).getTime() - now) / (1000 * 60 * 60 * 24)
      );
      return daysUntilDue >= 0 && daysUntilDue <= 14;
    }).length,
  };

  // Categorise enrolments
  const inProgressEnrolments = typedEnrolments
    .filter((e) => e.status === "in_progress" || e.status === "enrolled")
    .sort((a, b) => {
      if (a.due_date && b.due_date)
        return (
          new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        );
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return (b.progress_percent ?? 0) - (a.progress_percent ?? 0);
    });

  const completedEnrolments = typedEnrolments.filter(
    (e) => e.status === "completed"
  );

  // Find the resume course — most recently started in-progress course
  const resumeEnrolment =
    typedEnrolments
      .filter((e) => e.status === "in_progress")
      .sort((a, b) => {
        const aStart = a.started_at ? new Date(a.started_at).getTime() : 0;
        const bStart = b.started_at ? new Date(b.started_at).getTime() : 0;
        return bStart - aStart;
      })[0] ?? null;

  // Fetch the next incomplete lesson for the resume course
  let resumeLessonHref: string | null = null;
  if (resumeEnrolment) {
    const { data: resumeLessons } = await supabase
      .from("course_lessons")
      .select("id")
      .eq("course_id", resumeEnrolment.course_id)
      .eq("is_active", true)
      .order("sort_order");

    if (resumeLessons && resumeLessons.length > 0) {
      const { data: completions } = await supabase
        .from("lesson_completions")
        .select("lesson_id")
        .eq("user_id", user.id)
        .in(
          "lesson_id",
          resumeLessons.map((l) => l.id)
        );

      const completedIds = new Set(
        completions?.map((c) => c.lesson_id) ?? []
      );
      const nextLesson = resumeLessons.find((l) => !completedIds.has(l.id));
      if (nextLesson) {
        resumeLessonHref = `/learning/courses/${resumeEnrolment.course_id}/lessons/${nextLesson.id}`;
      }
    }
  }

  // Stats for compact bar
  const totalEnrolled = typedEnrolments.length;
  const totalInProgress = inProgressEnrolments.length;
  const totalCompleted = completedEnrolments.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Learning"
        subtitle="Track your progress and develop your skills"
        actions={
          <Button asChild>
            <Link href="/learning/courses">
              <BookOpen className="h-4 w-4 mr-2" />
              Browse Catalogue
            </Link>
          </Button>
        }
      />

      {/* Continue Learning hero */}
      {resumeEnrolment && resumeLessonHref && (
        <Link href={resumeLessonHref} className="block">
          <Card className="border-primary/20 bg-primary/5 transition-shadow hover:shadow-md cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10 shrink-0">
                  <PlayCircle className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary mb-0.5">
                    Continue where you left off
                  </p>
                  <p className="font-semibold truncate">
                    {resumeEnrolment.course.title}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1">
                      <Progress
                        value={resumeEnrolment.progress_percent}
                        className="h-1.5"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground shrink-0">
                      {resumeEnrolment.progress_percent}%
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-primary shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Compliance alert — overdue takes priority */}
      {complianceStats.overdue > 0 ? (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-lg text-destructive">
                {complianceStats.overdue} compliance{" "}
                {complianceStats.overdue === 1 ? "course" : "courses"} overdue
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="destructive">
              <Link href="/learning/courses?category=compliance">
                Complete Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : complianceStats.dueSoon > 0 ? (
        <Card className="border-mcr-orange bg-mcr-orange/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-mcr-orange" />
              <CardTitle className="text-lg">
                {complianceStats.dueSoon} compliance{" "}
                {complianceStats.dueSoon === 1 ? "course" : "courses"} due soon
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/learning/courses?category=compliance">
                View Compliance Courses
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : complianceStats.total > 0 &&
        complianceStats.completed === complianceStats.total ? (
        <Card className="border-green-500 bg-green-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg text-green-700">
                All compliance training complete
              </CardTitle>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      {/* Compact stats bar */}
      {totalEnrolled > 0 && (
        <p className="text-sm text-muted-foreground">
          {totalEnrolled} enrolled &middot; {totalInProgress} in progress
          &middot; {totalCompleted} completed
        </p>
      )}

      {/* Course tabs */}
      <Tabs defaultValue="in_progress" className="w-full">
        <TabsList variant="line">
          <TabsTrigger value="in_progress">
            In Progress ({totalInProgress})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({totalCompleted})
          </TabsTrigger>
          <TabsTrigger value="external">
            External ({externalCourses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="in_progress" className="mt-6">
          {inProgressEnrolments.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {inProgressEnrolments.map((enrolment) => (
                <EnrolledCourseCard
                  key={enrolment.id}
                  enrolment={enrolment}
                  now={now}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <PlayCircle className="h-10 w-10 text-muted-foreground/50 mb-4" />
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  No courses in progress yet.
                </p>
                <p className="text-sm text-muted-foreground/70 mb-4">
                  Browse the catalogue to find something new.
                </p>
                <Button asChild>
                  <Link href="/learning/courses">Browse Catalogue</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {completedEnrolments.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedEnrolments.map((enrolment) => (
                <EnrolledCourseCard
                  key={enrolment.id}
                  enrolment={enrolment}
                  now={now}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <GraduationCap className="h-10 w-10 text-muted-foreground/50 mb-4" />
                <p className="text-sm font-medium text-muted-foreground">
                  No completed courses yet.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="external" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Track courses you&apos;ve completed outside the platform.
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
                  <Globe className="h-10 w-10 text-muted-foreground/50 mb-4" />
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    No external courses logged yet.
                  </p>
                  <p className="text-sm text-muted-foreground/70 mb-4">
                    Track courses you&apos;ve completed outside the platform.
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
