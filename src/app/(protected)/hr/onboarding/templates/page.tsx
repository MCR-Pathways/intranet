import { redirect } from "next/navigation";
import { getCurrentUser, isHRAdminEffective } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { OnboardingTemplateManagement } from "@/components/hr/onboarding-template-management";
import { fetchTemplates, fetchTemplateItems } from "@/app/(protected)/hr/onboarding/actions";

export default async function OnboardingTemplatesPage() {
  const { user, profile } = await getCurrentUser();

  if (!user || !profile) {
    redirect("/login");
  }

  if (!isHRAdminEffective(profile)) {
    redirect("/hr");
  }

  const templates = await fetchTemplates();

  // Pre-fetch items for all templates
  const templateItemsMap: Record<string, Awaited<ReturnType<typeof fetchTemplateItems>>> = {};
  await Promise.all(
    templates.map(async (t) => {
      templateItemsMap[t.id] = await fetchTemplateItems(t.id);
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding Templates"
        subtitle="Configure checklist templates for new starters"
        breadcrumbs={[
          { label: "Admin", href: "/hr" },
          { label: "Onboarding", href: "/hr/onboarding" },
          { label: "Templates" },
        ]}
      />
      <OnboardingTemplateManagement
        templates={templates}
        templateItemsMap={templateItemsMap}
      />
    </div>
  );
}
