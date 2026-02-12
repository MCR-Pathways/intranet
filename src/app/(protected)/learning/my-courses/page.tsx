import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Lightbulb,
  Users,
  Clock,
  CheckCircle2,
  PlayCircle,
  AlertTriangle,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import type { CourseCategory, EnrollmentWithCourse } from "@/types/database.types";
import { formatDuration } from "@/lib/utils";

const categoryConfig: Record<CourseCategory, { label: string; icon: typeof Shield; color: string }> = {
  compliance: { label: "Compliance", icon: Shield, color: "text-red-600" },
  upskilling: { label: "Upskilling", icon: Lightbulb, color: "text-blue-600" },
  soft_skills: { label: "Soft Skills", icon: Users, color: "text-purple-600" },
};

function EnrolledCourseCard({ enrollment }: { enrollment: EnrollmentWithCourse }) {
  const { course } = enrollment;
  const config = categoryConfig[course.category];
  const Icon = config.icon;

  const isCompleted = enrollment.status === "completed";
  const isInProgress = enrollment.status === "in_progress";

  // Calculate due date status
  let dueStatus: "overdue" | "due_soon" | "on_track" | null = null;
  let daysUntilDue: number | null = null;

  if (enrollment.due_date && !isCompleted) {
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
    <Link href={`/learning/courses/${course.id}`}>
      <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${config.color}`} />
              <CardTitle className="text-base line-clamp-2">{course.title}</CardTitle>
            </div>
            {course.is_required && (
              <Badge variant="destructive" className="shrink-0">Required</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {isCompleted ? (
              <Badge variant="success">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completed
              </Badge>
            ) : isInProgress ? (
              <Badge variant="warning">
                <PlayCircle className="h-3 w-3 mr-1" />
                In Progress
              </Badge>
            ) : (
              <Badge variant="muted">Enrolled</Badge>
            )}
            {dueStatus === "overdue" && (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Overdue
              </Badge>
            )}
            {dueStatus === "due_soon" && (
              <Badge variant="warning">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Due in {daysUntilDue} days
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress bar */}
          {!isCompleted && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{enrollment.progress_percent}%</span>
              </div>
              <Progress value={enrollment.progress_percent} />
            </div>
          )}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(course.duration_minutes)}
            </div>
            <Badge variant="outline" className="text-xs">
              {config.label}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function MyCoursesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch user's enrollments with course details
  const { data: enrollments } = await supabase
    .from("course_enrollments")
    .select(`
      *,
      course:courses(*)
    `)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  // Filter and type cast enrollments
  const typedEnrollments = (enrollments || [])
    .filter((e) => e.course)
    .map((e) => ({
      ...e,
      course: e.course as EnrollmentWithCourse["course"],
    })) as EnrollmentWithCourse[];

  // Categorize enrollments
  const inProgressCourses = typedEnrollments.filter(
    (e) => e.status === "in_progress" || e.status === "enrolled"
  );
  const completedCourses = typedEnrollments.filter(
    (e) => e.status === "completed"
  );

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
            Browse Catalog
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
            <p className="text-2xl font-bold">{typedEnrollments.length}</p>
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
        <Card className="border-secondary bg-secondary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-secondary" />
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
        <TabsList>
          <TabsTrigger value="in_progress">
            In Progress ({inProgressCourses.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedCourses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="in_progress" className="mt-6">
          {inProgressCourses.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {inProgressCourses.map((enrollment) => (
                <EnrolledCourseCard key={enrollment.id} enrollment={enrollment} />
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
                  <Link href="/learning/courses">Browse Course Catalog</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {completedCourses.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedCourses.map((enrollment) => (
                <EnrolledCourseCard key={enrollment.id} enrollment={enrollment} />
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
      </Tabs>
    </div>
  );
}
