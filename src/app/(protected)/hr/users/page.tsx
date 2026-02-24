import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserTable } from "@/components/hr/user-table";

/** Extended select for the user management table — includes HR fields. */
const USER_TABLE_SELECT =
  "id, full_name, preferred_name, email, user_type, status, is_hr_admin, is_ld_admin, is_line_manager, job_title, avatar_url, induction_completed_at, fte, department, region, contract_type, work_pattern, start_date, probation_end_date, contract_end_date, is_external, line_manager_id, team_id";

export default async function UserManagementPage() {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!profile?.is_hr_admin) {
    redirect("/intranet");
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select(USER_TABLE_SELECT)
    .order("full_name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage staff profiles, roles, and induction status
        </p>
      </div>
      <UserTable profiles={profiles ?? []} />
    </div>
  );
}
