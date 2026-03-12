import { redirect } from "next/navigation";
import { getCurrentUser, isLDAdminEffective } from "@/lib/auth";
import { ReportsDashboard } from "@/components/learning-admin/reports-dashboard";
import { PageHeader } from "@/components/layout/page-header";

export default async function ReportsPage() {
  const { supabase, profile } = await getCurrentUser();

  if (!isLDAdminEffective(profile)) {
    redirect("/learning");
  }

  // Fetch overview data in parallel for faster page loads
  const [
    { data: enrolments },
    { data: courses },
    { data: profiles },
    { data: teams },
  ] = await Promise.all([
    supabase
      .from("course_enrolments")
      .select(
        "id, user_id, course_id, status, progress_percent, score, completed_at, due_date"
      ),
    supabase
      .from("courses")
      .select("id, title, category, is_active, is_required")
      .order("title"),
    supabase
      .from("profiles")
      .select("id, full_name, email, user_type, team_id, status, is_external")
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("teams")
      .select("id, name")
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Reports"
        subtitle="Track course completion and learner progress across your organisation."
        breadcrumbs={[
          { label: "Admin", href: "/hr" },
          { label: "L&D Reports" },
        ]}
      />

      <ReportsDashboard
        enrolments={enrolments ?? []}
        courses={courses ?? []}
        profiles={profiles ?? []}
        teams={teams ?? []}
      />
    </div>
  );
}
