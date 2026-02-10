import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Briefcase, Building2, Shield, Bell } from "lucide-react";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile with team info
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, teams(name)")
    .eq("id", user.id)
    .single();

  const displayName = profile?.preferred_name || profile?.full_name || "User";

  const statusVariant =
    profile?.status === "active"
      ? "success"
      : profile?.status === "inactive"
        ? "destructive"
        : "warning";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Your personal details. Contact HR to update your information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Full Name
              </p>
              <p className="text-sm">{profile?.full_name || "Not set"}</p>
            </div>
            {profile?.preferred_name && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Preferred Name
                </p>
                <p className="text-sm">{profile.preferred_name}</p>
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  Email
                </p>
              </div>
              <p className="text-sm">{user.email}</p>
            </div>
            {profile?.phone && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Phone
                </p>
                <p className="text-sm">{profile.phone}</p>
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  Job Title
                </p>
              </div>
              <p className="text-sm">{profile?.job_title || "Not set"}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  Team
                </p>
              </div>
              <p className="text-sm">
                {(profile?.teams as { name: string } | null)?.name || "Not assigned"}
              </p>
            </div>
            {profile?.start_date && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Start Date
                </p>
                <p className="text-sm">
                  {new Date(profile.start_date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Account
          </CardTitle>
          <CardDescription>
            Your account status and role information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Account Status
              </p>
              <Badge variant={statusVariant}>
                {profile?.status === "pending_induction"
                  ? "Pending Induction"
                  : profile?.status === "active"
                    ? "Active"
                    : "Inactive"}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                User Type
              </p>
              <p className="text-sm capitalize">
                {profile?.user_type?.replace("_", " ") || "Unknown"}
              </p>
            </div>
            {profile?.is_line_manager && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Role
                </p>
                <Badge variant="outline">Line Manager</Badge>
              </div>
            )}
            {profile?.is_hr_admin && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Admin Access
                </p>
                <Badge variant="outline">HR Admin</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preferences - Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Preferences
          </CardTitle>
          <CardDescription>
            Notification and display preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Preference settings will be available soon. You&apos;ll be able to
            customise your notification preferences, display options, and more.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
