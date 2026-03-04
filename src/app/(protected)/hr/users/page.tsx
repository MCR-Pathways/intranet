import { getCurrentUser, isHRAdminEffective, isSystemsAdminEffective } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserTable } from "@/components/hr/user-table";
import { PageHeader } from "@/components/layout/page-header";

/** Extended select for the user management table — includes HR fields. */
const USER_TABLE_SELECT =
  "id, full_name, preferred_name, email, user_type, status, is_hr_admin, is_ld_admin, is_systems_admin, is_line_manager, job_title, avatar_url, induction_completed_at, fte, department, region, contract_type, work_pattern, start_date, probation_end_date, contract_end_date, is_external, line_manager_id, team_id";

export default async function UserManagementPage() {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // HR admin or systems admin can view user management
  if (!isHRAdminEffective(profile) && !isSystemsAdminEffective(profile)) {
    redirect("/intranet");
  }

  const [{ data: profiles }, { data: departmentRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select(USER_TABLE_SELECT)
      .order("full_name"),
    supabase
      .from("departments")
      .select("slug, name")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const departments = (departmentRows ?? []).map((d) => ({
    slug: d.slug as string,
    name: d.name as string,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Manage staff profiles, roles, and induction status"
      />
      <UserTable profiles={profiles ?? []} currentUserId={user.id} departments={departments} />
    </div>
  );
}
