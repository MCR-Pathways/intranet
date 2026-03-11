import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Bell } from "lucide-react";
import { getMyPatterns } from "@/app/(protected)/sign-in/actions";
import { DefaultWeekEditor } from "@/components/sign-in/default-week-editor";
import type { WeeklyPatternEntry } from "@/lib/sign-in";

const USER_TYPE_LABELS: Record<string, string> = {
  staff: "Staff",
  pathways_coordinator: "Pathways Coordinator",
  new_user: "New User",
};

export default async function SettingsPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile — explicit columns, never select("*")
  const [{ data: profile }, patternData] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, user_type, status, is_hr_admin, is_ld_admin, is_line_manager"
      )
      .eq("id", user.id)
      .single(),
    getMyPatterns(),
  ]);

  const statusVariant =
    profile?.status === "active"
      ? "success"
      : profile?.status === "inactive"
        ? "destructive"
        : "warning";

  const statusLabel =
    profile?.status === "pending_induction"
      ? "Pending Induction"
      : profile?.status === "active"
        ? "Active"
        : profile?.status === "inactive"
          ? "Inactive"
          : profile?.status
            ? profile.status.charAt(0).toUpperCase() + profile.status.slice(1)
            : "Unknown";

  const userTypeLabel =
    USER_TYPE_LABELS[profile?.user_type ?? ""] ?? profile?.user_type ?? "Unknown";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage your account and preferences"
      />

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
              <Badge variant={statusVariant}>{statusLabel}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                User Type
              </p>
              <p className="text-sm">{userTypeLabel}</p>
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
            {profile?.is_ld_admin && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Admin Access
                </p>
                <Badge variant="outline">L&D Admin</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Default working week pattern */}
      <DefaultWeekEditor
        initialPatterns={patternData.patterns as WeeklyPatternEntry[]}
      />

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
