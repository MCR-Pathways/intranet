import { redirect } from "next/navigation";
import { getCurrentUser, isLDAdminEffective } from "@/lib/auth";
import { CourseManagementTable } from "@/components/learning-admin/course-management-table";
import { PageHeader } from "@/components/layout/page-header";

export default async function CourseManagementPage() {
  const { supabase, profile } = await getCurrentUser();

  if (!isLDAdminEffective(profile)) {
    redirect("/learning");
  }

  const { data: courses } = await supabase
    .from("courses")
    .select(
      "id, title, description, category, duration_minutes, is_required, thumbnail_url, is_active, status, content_url, passing_score, due_days_from_start, feedback_avg, feedback_count, created_by, updated_by, created_at, updated_at"
    )
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Management"
        subtitle="Create, edit, and manage courses for your organisation."
        breadcrumbs={[
          { label: "Admin", href: "/hr" },
          { label: "Course Management" },
        ]}
      />

      <CourseManagementTable courses={courses ?? []} />
    </div>
  );
}
