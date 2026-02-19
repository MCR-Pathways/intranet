import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ReportsDashboard } from "@/components/learning-admin/reports-dashboard";

export default async function ReportsPage() {
  const { supabase, profile } = await getCurrentUser();

  if (!profile?.is_ld_admin) {
    redirect("/learning");
  }

  // Fetch overview data in parallel for faster page loads
  const [
    { data: enrollments },
    { data: courses },
    { data: profiles },
    { data: teams },
  ] = await Promise.all([
    supabase
      .from("course_enrollments")
      .select(
        "id, user_id, course_id, status, progress_percent, score, completed_at, due_date"
      ),
    supabase
      .from("courses")
      .select("id, title, category, is_active, is_required")
      .order("title"),
    supabase
      .from("profiles")
      .select("id, full_name, email, user_type, team_id, status")
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("teams")
      .select("id, name")
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Learning Reports
        </h1>
        <p className="text-muted-foreground">
          Track course completion and learner progress across your organisation.
        </p>
      </div>

      <ReportsDashboard
        enrollments={enrollments ?? []}
        courses={courses ?? []}
        profiles={profiles ?? []}
        teams={teams ?? []}
      />
    </div>
  );
}
