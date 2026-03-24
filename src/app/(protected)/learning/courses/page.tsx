import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Shield, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import type { CourseEnrolment } from "@/types/database.types";
import { CourseCatalogue } from "@/components/learning/course-catalogue";

export default async function CourseCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch courses and enrolments in parallel
  const [{ data: courses }, { data: enrolments }] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, title, description, category, duration_minutes, is_required, is_active, status, updated_at"
      )
      .eq("is_active", true)
      .eq("status", "published")
      .order("is_required", { ascending: false })
      .order("title"),
    supabase
      .from("course_enrolments")
      .select(
        "id, user_id, course_id, status, progress_percent, score, enrolled_at, started_at, completed_at, due_date, created_at, updated_at"
      )
      .eq("user_id", user.id),
  ]);

  // Build enrolment map as a serialisable object (Maps can't cross server→client boundary)
  const enrolmentRecord: Record<string, CourseEnrolment> = {};
  for (const e of enrolments ?? []) {
    enrolmentRecord[e.course_id] = e;
  }

  // Compliance stats for the summary banner
  const complianceCourses =
    courses?.filter((c) => c.category === "compliance") ?? [];
  const completedCompliance = complianceCourses.filter(
    (c) => enrolmentRecord[c.id]?.status === "completed"
  ).length;
  const now = Date.now(); // eslint-disable-line react-hooks/purity -- server component runs once per request
  const dueSoonCompliance = complianceCourses.filter((c) => {
    const enrolment = enrolmentRecord[c.id];
    if (!enrolment?.due_date || enrolment.status === "completed") return false;
    const daysUntilDue = Math.ceil(
      (new Date(enrolment.due_date).getTime() - now) / (1000 * 60 * 60 * 24)
    );
    return daysUntilDue <= 14 && daysUntilDue >= 0;
  }).length;

  // Serialisable course data for the client component
  const catalogueCourses = (courses ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    category: c.category,
    duration_minutes: c.duration_minutes,
    is_required: c.is_required,
  }));

  return (
    <div className="space-y-6">
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

      {/* Compact compliance summary banner */}
      {complianceCourses.length > 0 && (
        <Card className="border-mcr-orange bg-mcr-orange/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-mcr-orange" />
              <CardTitle className="text-lg">Compliance Training</CardTitle>
            </div>
            <CardDescription>
              {completedCompliance} of {complianceCourses.length} required
              courses completed
              {dueSoonCompliance > 0 && (
                <span className="text-destructive font-medium ml-2">
                  ({dueSoonCompliance} due soon)
                </span>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Course catalogue with filter chips */}
      <CourseCatalogue
        courses={catalogueCourses}
        enrolments={enrolmentRecord}
        initialCategory={category}
      />
    </div>
  );
}
