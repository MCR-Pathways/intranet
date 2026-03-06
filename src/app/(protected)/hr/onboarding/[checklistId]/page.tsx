import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { OnboardingChecklistContent } from "@/components/hr/onboarding-checklist-content";
import { fetchChecklistDetail } from "@/app/(protected)/hr/onboarding/actions";

interface OnboardingDetailPageProps {
  params: Promise<{ checklistId: string }>;
}

export default async function OnboardingDetailPage({ params }: OnboardingDetailPageProps) {
  const { checklistId } = await params;
  const { user } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { checklist, items } = await fetchChecklistDetail(checklistId);

  if (!checklist) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={checklist.employee_name}
        subtitle="Onboarding checklist"
        breadcrumbs={[
          { label: "HR", href: "/hr" },
          { label: "Onboarding", href: "/hr/onboarding" },
          { label: checklist.employee_name },
        ]}
      />
      <OnboardingChecklistContent checklist={checklist} items={items} />
    </div>
  );
}
