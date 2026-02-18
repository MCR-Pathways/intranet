import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CourseManagementTable } from "@/components/learning-admin/course-management-table";

export default async function CourseManagementPage() {
  const { supabase, profile } = await getCurrentUser();

  if (!profile?.is_ld_admin) {
    redirect("/learning");
  }

  const { data: courses } = await supabase
    .from("courses")
    .select(
      "id, title, description, category, duration_minutes, is_required, thumbnail_url, is_active, status, content_url, passing_score, due_days_from_start, created_by, updated_by, created_at, updated_at"
    )
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Course Management
        </h1>
        <p className="text-muted-foreground">
          Create, edit, and manage courses for your organisation.
        </p>
      </div>

      <CourseManagementTable courses={courses ?? []} />
    </div>
  );
}
