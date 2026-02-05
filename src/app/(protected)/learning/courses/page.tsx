import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import {
  Shield,
  Lightbulb,
  Users,
  Clock,
  CheckCircle2,
  PlayCircle,
  BookOpen,
} from "lucide-react";
import type { Course, CourseCategory, CourseEnrollment } from "@/types/database.types";

const categoryConfig: Record<CourseCategory, { label: string; icon: typeof Shield; color: string }> = {
  compliance: { label: "Compliance", icon: Shield, color: "text-red-600" },
  upskilling: { label: "Upskilling", icon: Lightbulb, color: "text-blue-600" },
  soft_skills: { label: "Soft Skills", icon: Users, color: "text-purple-600" },
};

function formatDuration(minutes: number | null): string {
  if (!minutes) return "Self-paced";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function CourseCard({
  course,
  enrollment,
}: {
  course: Course;
  enrollment?: CourseEnrollment | null;
}) {
  const config = categoryConfig[course.category];
  const Icon = config.icon;

  const getStatusBadge = () => {
    if (!enrollment) return null;

    switch (enrollment.status) {
      case "completed":
        return <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case "in_progress":
        return <Badge variant="warning"><PlayCircle className="h-3 w-3 mr-1" />{enrollment.progress_percent}% Complete</Badge>;
      case "enrolled":
        return <Badge variant="muted">Enrolled</Badge>;
      default:
        return null;
    }
  };

  const getDueDateBadge = () => {
    if (!enrollment?.due_date) return null;

    const dueDate = new Date(enrollment.due_date);
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (enrollment.status === "completed") return null;

    if (daysUntilDue < 0) {
      return <Badge variant="destructive">Overdue</Badge>;
    } else if (daysUntilDue <= 7) {
      return <Badge variant="warning">Due in {daysUntilDue} days</Badge>;
    }
    return null;
  };

  return (
    <Link href={`/learning/courses/${course.id}`}>
      <Card className="transition-shadow hover:shadow-md cursor-pointer h-full flex flex-col">
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
            {getStatusBadge()}
            {getDueDateBadge()}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <CardDescription className="line-clamp-2 mb-4 flex-1">
            {course.description}
          </CardDescription>
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

export default async function CourseCatalogPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch all active courses
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("is_active", true)
    .order("is_required", { ascending: false })
    .order("title");

  // Fetch user's enrollments
  const { data: enrollments } = await supabase
    .from("course_enrollments")
    .select("*")
    .eq("user_id", user.id);

  const enrollmentMap = new Map(
    enrollments?.map((e) => [e.course_id, e]) || []
  );

  const coursesByCategory = {
    compliance: courses?.filter((c) => c.category === "compliance") || [],
    upskilling: courses?.filter((c) => c.category === "upskilling") || [],
    soft_skills: courses?.filter((c) => c.category === "soft_skills") || [],
  };

  // Calculate stats
  const complianceCourses = coursesByCategory.compliance;
  const completedCompliance = complianceCourses.filter(
    (c) => enrollmentMap.get(c.id)?.status === "completed"
  ).length;
  const dueSoonCompliance = complianceCourses.filter((c) => {
    const enrollment = enrollmentMap.get(c.id);
    if (!enrollment?.due_date || enrollment.status === "completed") return false;
    const daysUntilDue = Math.ceil(
      (new Date(enrollment.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilDue <= 14 && daysUntilDue >= 0;
  }).length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Course Catalog</h1>
          <p className="text-muted-foreground mt-1">
            Browse and enroll in available courses
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/learning/my-courses">
            <BookOpen className="h-4 w-4 mr-2" />
            My Courses
          </Link>
        </Button>
      </div>

      {/* Compliance summary */}
      {complianceCourses.length > 0 && (
        <Card className="border-secondary bg-secondary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-secondary" />
              <CardTitle className="text-lg">Compliance Training</CardTitle>
            </div>
            <CardDescription>
              {completedCompliance} of {complianceCourses.length} required courses completed
              {dueSoonCompliance > 0 && (
                <span className="text-destructive font-medium ml-2">
                  ({dueSoonCompliance} due soon)
                </span>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Course tabs by category */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Courses</TabsTrigger>
          <TabsTrigger value="compliance">
            Compliance ({coursesByCategory.compliance.length})
          </TabsTrigger>
          <TabsTrigger value="upskilling">
            Upskilling ({coursesByCategory.upskilling.length})
          </TabsTrigger>
          <TabsTrigger value="soft_skills">
            Soft Skills ({coursesByCategory.soft_skills.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {courses && courses.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  enrollment={enrollmentMap.get(course.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </TabsContent>

        {(["compliance", "upskilling", "soft_skills"] as const).map((category) => (
          <TabsContent key={category} value={category} className="mt-6">
            {coursesByCategory[category].length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {coursesByCategory[category].map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    enrollment={enrollmentMap.get(course.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState category={categoryConfig[category].label} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function EmptyState({ category }: { category?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          {category
            ? `No ${category.toLowerCase()} courses available yet.`
            : "No courses available yet."}
        </p>
      </CardContent>
    </Card>
  );
}
