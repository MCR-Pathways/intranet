import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import {
  GraduationCap,
  Shield,
  Lightbulb,
  BookOpen,
  ArrowRight,
  Clock,
  AlertTriangle,
  PlayCircle,
  CheckCircle2,
} from "lucide-react";
import type { EnrollmentWithCourse } from "@/types/database.types";
import { formatDuration } from "@/lib/utils";
import { categoryConfig } from "@/lib/learning";

export default async function LearningPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch courses and enrollments in parallel for faster page loads
  const [{ data: courses }, { data: enrollments }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, description, category, duration_minutes, is_required, thumbnail_url, content_url, passing_score, due_days_from_start, is_active, status, created_by, updated_by, created_at, updated_at")
      .eq("is_active", true)
      .eq("status", "published"),
    supabase
      .from("course_enrollments")
      .select(`
        id, user_id, course_id, status, progress_percent, score, enrolled_at, started_at, completed_at, due_date, created_at, updated_at,
        course:courses(id, title, description, category, duration_minutes, is_required, thumbnail_url, content_url, passing_score, due_days_from_start, is_active, created_by, updated_by, created_at, updated_at)
      `)
      .eq("user_id", user.id),
  ]);

  // Type and filter enrollments
  const typedEnrollments = (enrollments || [])
    .filter((e) => e.course)
    .map((e) => ({
      ...e,
      course: e.course as unknown as EnrollmentWithCourse["course"],
    })) as EnrollmentWithCourse[];

  // Calculate stats by category
  const coursesByCategory = {
    compliance: courses?.filter((c) => c.category === "compliance") || [],
    upskilling: courses?.filter((c) => c.category === "upskilling") || [],
    soft_skills: courses?.filter((c) => c.category === "soft_skills") || [],
  };

  // Get enrollment stats
  const enrollmentMap = new Map(
    typedEnrollments.map((e) => [e.course_id, e])
  );

  const now = Date.now(); // eslint-disable-line react-hooks/purity -- server component runs once per request

  const complianceStats = {
    total: coursesByCategory.compliance.length,
    completed: coursesByCategory.compliance.filter(
      (c) => enrollmentMap.get(c.id)?.status === "completed"
    ).length,
    due: coursesByCategory.compliance.filter((c) => {
      const enrollment = enrollmentMap.get(c.id);
      if (!enrollment || enrollment.status === "completed") return false;
      if (!enrollment.due_date) return c.is_required;
      const daysUntilDue = Math.ceil(
        (new Date(enrollment.due_date).getTime() - now) / (1000 * 60 * 60 * 24)
      );
      return daysUntilDue <= 14;
    }).length,
    overdue: coursesByCategory.compliance.filter((c) => {
      const enrollment = enrollmentMap.get(c.id);
      if (!enrollment?.due_date || enrollment.status === "completed") return false;
      const daysUntilDue = Math.ceil(
        (new Date(enrollment.due_date).getTime() - now) / (1000 * 60 * 60 * 24)
      );
      return daysUntilDue < 0;
    }).length,
  };

  // Get in-progress courses for display
  const inProgressEnrollments = typedEnrollments
    .filter((e) => e.status === "in_progress" || e.status === "enrolled")
    .sort((a, b) => {
      // Sort by due date (soonest first), then by progress (highest first)
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return b.progress_percent - a.progress_percent;
    })
    .slice(0, 3);

  const hasComplianceDue = complianceStats.due > 0 || complianceStats.overdue > 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learning</h1>
        <p className="text-muted-foreground mt-1">
          Develop your skills and complete required training
        </p>
      </div>

      {/* Compliance alert */}
      {complianceStats.overdue > 0 ? (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-lg text-destructive">Overdue Compliance Training</CardTitle>
            </div>
            <CardDescription className="text-destructive/80">
              You have {complianceStats.overdue} overdue compliance course{complianceStats.overdue > 1 ? "s" : ""} that must be completed immediately.
            </CardDescription>
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
      ) : hasComplianceDue ? (
        <Card className="border-secondary bg-secondary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-secondary" />
              <CardTitle className="text-lg">Compliance Training Due</CardTitle>
            </div>
            <CardDescription>
              You have {complianceStats.due} compliance course{complianceStats.due > 1 ? "s" : ""} due soon. Complete them to stay compliant.
            </CardDescription>
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
      ) : complianceStats.total > 0 && complianceStats.completed === complianceStats.total ? (
        <Card className="border-green-500 bg-green-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg text-green-700">All Compliance Training Complete</CardTitle>
            </div>
            <CardDescription className="text-green-600">
              You have completed all {complianceStats.total} required compliance courses.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* Course categories */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/learning/courses?category=compliance">
          <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Compliance Courses
              </CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                {complianceStats.overdue > 0 && (
                  <Badge variant="destructive">{complianceStats.overdue} overdue</Badge>
                )}
                {complianceStats.due > 0 && complianceStats.overdue === 0 && (
                  <Badge variant="warning">{complianceStats.due} due</Badge>
                )}
                <Badge variant="muted">{complianceStats.completed} completed</Badge>
              </div>
              <CardDescription>
                Required training for all staff
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/learning/courses?category=upskilling">
          <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Upskilling
              </CardTitle>
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="muted">{coursesByCategory.upskilling.length} available</Badge>
              </div>
              <CardDescription>
                Optional courses to develop new skills
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/learning/tool-shed">
          <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tool Shed</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Searchable library of insights, best practices, and practical
                tools
              </CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* My courses section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>My Courses</CardTitle>
            <CardDescription>Courses you&apos;re currently working on</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/learning/my-courses">View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {inProgressEnrollments.length > 0 ? (
            <div className="space-y-4">
              {inProgressEnrollments.map((enrollment) => {
                const config = categoryConfig[enrollment.course.category];
                const Icon = config.icon;

                // Calculate due date status
                let dueStatus: "overdue" | "due_soon" | null = null;
                let daysUntilDue: number | null = null;

                if (enrollment.due_date) {
                  daysUntilDue = Math.ceil(
                    (new Date(enrollment.due_date).getTime() - now) / (1000 * 60 * 60 * 24)
                  );
                  if (daysUntilDue < 0) dueStatus = "overdue";
                  else if (daysUntilDue <= 7) dueStatus = "due_soon";
                }

                return (
                  <Link
                    key={enrollment.id}
                    href={`/learning/courses/${enrollment.course_id}`}
                    className="block"
                  >
                    <div className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <Icon className={`h-8 w-8 ${config.color} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">{enrollment.course.title}</p>
                          {dueStatus === "overdue" && (
                            <Badge variant="destructive" className="shrink-0">Overdue</Badge>
                          )}
                          {dueStatus === "due_soon" && (
                            <Badge variant="warning" className="shrink-0">Due in {daysUntilDue}d</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <Progress value={enrollment.progress_percent} className="h-2" />
                          </div>
                          <span className="text-sm text-muted-foreground shrink-0">
                            {enrollment.progress_percent}%
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="h-4 w-4" />
                        {formatDuration(enrollment.course.duration_minutes)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center max-w-sm mb-4">
                You haven&apos;t started any courses yet. Browse the course catalog to
                get started.
              </p>
              <Button asChild>
                <Link href="/learning/courses">
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Browse Courses
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
