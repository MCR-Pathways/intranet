import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserTable } from "@/components/hr/user-table";

export default async function UserManagementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check HR admin access
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("is_hr_admin")
    .eq("id", user.id)
    .single();

  if (!currentProfile?.is_hr_admin) {
    redirect("/dashboard");
  }

  // Fetch all profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage staff profiles, roles, and induction status
        </p>
      </div>
      <UserTable profiles={profiles || []} />
    </div>
  );
}
