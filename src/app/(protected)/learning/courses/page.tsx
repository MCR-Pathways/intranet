import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Shield, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import type { Course, CourseEnrolment } from "@/types/database.types";
import { CourseCatalogContent } from "@/components/learning/course-catalog-content";

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
      .select("id, title, description, category, duration_minutes, is_required, thumbnail_url, content_url, passing_score, due_days_from_start, is_active, status, feedback_avg, feedback_count, created_by, updated_by, created_at, updated_at")
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

  // Calculate compliance stats
  const complianceCourses = (courses ?? []).filter((c) => c.category === "compliance");
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
      <PageHeader
        title="Course Catalogue"
        subtitle="Browse and enrol in available courses"
        actions={
          <Button asChild variant="outline">
            <Link href="/learning/my-courses">
              <BookOpen className="h-4 w-4 mr-2" />
              My Courses
            </Link>
          </Button>
        }
      />

      {/* Compliance summary */}
      {complianceCourses.length > 0 && (
        <Card className="border-mcr-orange bg-mcr-orange/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-mcr-orange" />
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

      <CourseCatalogContent
        courses={(courses ?? []) as Course[]}
        enrolmentMap={enrolmentMap as Map<string, CourseEnrolment>}
        defaultTab={defaultTab}
      />
    </div>
  );
}
