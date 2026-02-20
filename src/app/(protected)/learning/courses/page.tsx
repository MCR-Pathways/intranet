import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import {
  Shield,
  Clock,
  CheckCircle2,
  PlayCircle,
  BookOpen,
} from "lucide-react";
import type { Course, CourseEnrolment } from "@/types/database.types";
import { formatDuration } from "@/lib/utils";
import { categoryConfig } from "@/lib/learning";

function CourseCard({
  course,
  enrolment,
}: {
  course: Course;
  enrolment?: CourseEnrolment | null;
}) {
  const config = categoryConfig[course.category];
  const Icon = config.icon;

  const getStatusBadge = () => {
    if (!enrolment) return null;

    switch (enrolment.status) {
      case "completed":
        return <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case "in_progress":
        return <Badge variant="warning"><PlayCircle className="h-3 w-3 mr-1" />{enrolment.progress_percent}% Complete</Badge>;
      case "enrolled":
        return <Badge variant="muted">Enrolled</Badge>;
      default:
        return null;
    }
  };

  const getDueDateBadge = () => {
    if (!enrolment?.due_date) return null;

    const dueDate = new Date(enrolment.due_date);
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (enrolment.status === "completed") return null;

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

const validCategoryTabs = ["all", "compliance", "upskilling", "soft_skills"] as const;

export default async function CourseCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const defaultTab = validCategoryTabs.includes(category as (typeof validCategoryTabs)[number])
    ? (category as (typeof validCategoryTabs)[number])
    : "all";

  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch courses and enrolments in parallel for faster page loads
  const [{ data: courses }, { data: enrolments }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, description, category, duration_minutes, is_required, thumbnail_url, content_url, passing_score, due_days_from_start, is_active, status, created_by, updated_by, created_at, updated_at")
      .eq("is_active", true)
      .eq("status", "published")
      .order("is_required", { ascending: false })
      .order("title"),
    supabase
      .from("course_enrolments")
      .select("id, user_id, course_id, status, progress_percent, score, enrolled_at, started_at, completed_at, due_date, created_at, updated_at")
      .eq("user_id", user.id),
  ]);

  const enrolmentMap = new Map(
    enrolments?.map((e) => [e.course_id, e]) || []
  );

  const coursesByCategory = {
    compliance: courses?.filter((c) => c.category === "compliance") || [],
    upskilling: courses?.filter((c) => c.category === "upskilling") || [],
    soft_skills: courses?.filter((c) => c.category === "soft_skills") || [],
  };

  // Calculate stats
  const complianceCourses = coursesByCategory.compliance;
  const completedCompliance = complianceCourses.filter(
    (c) => enrolmentMap.get(c.id)?.status === "completed"
  ).length;
  const now = Date.now(); // eslint-disable-line react-hooks/purity -- server component runs once per request
  const dueSoonCompliance = complianceCourses.filter((c) => {
    const enrolment = enrolmentMap.get(c.id);
    if (!enrolment?.due_date || enrolment.status === "completed") return false;
    const daysUntilDue = Math.ceil(
      (new Date(enrolment.due_date).getTime() - now) / (1000 * 60 * 60 * 24)
    );
    return daysUntilDue <= 14 && daysUntilDue >= 0;
  }).length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Course Catalogue</h1>
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
      <Tabs key={defaultTab} defaultValue={defaultTab} className="w-full">
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
                  enrolment={enrolmentMap.get(course.id)}
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
                    enrolment={enrolmentMap.get(course.id)}
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
