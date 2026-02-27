import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { fetchCategoriesWithClient } from "./actions";
import { PageHeader } from "@/components/layout/page-header";
import { ResourcesGrid } from "@/components/resources/resources-grid";

export default async function ResourcesPage() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const isHRAdmin = profile.is_hr_admin ?? false;
  const categories = await fetchCategoriesWithClient(supabase);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resources"
        subtitle="Policies, guides, and reference materials"
        breadcrumbs={[
          { label: "Intranet", href: "/intranet" },
          { label: "Resources" },
        ]}
      />

      <ResourcesGrid categories={categories} isHRAdmin={isHRAdmin} />
    </div>
  );
}
