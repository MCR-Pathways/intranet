import { redirect } from "next/navigation";
import { getCurrentUser, isHRAdminEffective } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { OnboardingDashboardContent } from "@/components/hr/onboarding-dashboard-content";
import {
  fetchOnboardingDashboard,
  fetchActiveTemplates,
} from "@/app/(protected)/hr/onboarding/actions";

export default async function OnboardingDashboardPage() {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile) {
    redirect("/login");
  }

  if (!isHRAdminEffective(profile)) {
    redirect("/hr");
  }

  const [checklists, templates] = await Promise.all([
    fetchOnboardingDashboard(),
    fetchActiveTemplates(),
  ]);

  // Fetch all active employees for the person picker
  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, job_title")
    .eq("status", "active")
    .order("full_name");

  const employeeList = (employees ?? []).map((e) => ({
    id: e.id as string,
    full_name: (e.full_name as string) ?? "Unknown",
    job_title: e.job_title as string | null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding"
        subtitle="Track new starter onboarding progress"
        breadcrumbs={[
          { label: "HR", href: "/hr" },
          { label: "Onboarding" },
        ]}
      />
      <OnboardingDashboardContent
        checklists={checklists}
        templates={templates}
        employees={employeeList}
      />
    </div>
  );
}
