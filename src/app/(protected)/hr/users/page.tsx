import { getCurrentUser, isHRAdminEffective, isSystemsAdminEffective } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserTable } from "@/components/hr/user-table";
import { PageHeader } from "@/components/layout/page-header";

/** Extended select for the user management table — includes HR fields. */
const USER_TABLE_SELECT =
  "id, full_name, preferred_name, email, user_type, status, is_hr_admin, is_ld_admin, is_systems_admin, is_line_manager, job_title, avatar_url, induction_completed_at, fte, department, region, contract_type, work_pattern, start_date, probation_end_date, contract_end_date, is_external, line_manager_id, team_id, created_at";

export default async function UserManagementPage() {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // HR admin or systems admin can view user management
  if (!isHRAdminEffective(profile) && !isSystemsAdminEffective(profile)) {
    redirect("/intranet");
  }

  // Fetch profiles, departments, and teams in parallel
  const [{ data: profiles }, { data: departmentRows }, { data: teams }] = await Promise.all([
    supabase
      .from("profiles")
      .select(USER_TABLE_SELECT)
      .order("full_name"),
    supabase
      .from("departments")
      .select("slug, name")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("teams")
      .select("id, name")
      .order("name"),
  ]);

  const departments = (departmentRows ?? []).map((d) => ({
    slug: d.slug as string,
    name: d.name as string,
  }));

  // Extract minimal person options for comboboxes (from already-fetched profiles)
  const people = (profiles ?? [])
    .filter((p) => p.status === "active")
    .map((p) => ({
      id: p.id as string,
      full_name: p.full_name as string,
      job_title: p.job_title as string | null,
    }));

  // Map teams for combobox
  const teamOptions = (teams ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Manage staff profiles, roles, and induction status"
      />
      <UserTable
        profiles={profiles ?? []}
        currentUserId={user.id}
        departments={departments}
        isCurrentUserHRAdmin={isHRAdminEffective(profile)}
        people={people}
        teams={teamOptions}
        isCurrentUserHRAdmin={isHRAdminEffective(profile)}
      />
    </div>
  );
}
