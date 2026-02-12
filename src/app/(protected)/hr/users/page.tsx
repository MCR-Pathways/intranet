import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserTable } from "@/components/hr/user-table";
import type { Profile } from "@/types/database.types";

export default async function UserManagementPage() {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!profile?.is_hr_admin) {
    redirect("/intranet");
  }

  // Select only the fields needed by UserTable and UserEditDialog
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, full_name, preferred_name, email, user_type, status, is_hr_admin, is_line_manager, job_title, avatar_url, induction_completed_at"
    )
    .order("full_name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage staff profiles, roles, and induction status
        </p>
      </div>
      <UserTable profiles={(profiles as Profile[]) || []} />
    </div>
  );
}
