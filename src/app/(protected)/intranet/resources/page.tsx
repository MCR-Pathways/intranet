import { redirect } from "next/navigation";
import { getCurrentUser, isHRAdminEffective } from "@/lib/auth";
import {
  fetchCategoriesWithClient,
  fetchFeaturedArticles,
} from "./actions";
import { PageHeader } from "@/components/layout/page-header";
import { FeaturedResources } from "@/components/resources/featured-resources";
import { ResourcesGrid } from "@/components/resources/resources-grid";

export default async function ResourcesPage() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const isHRAdmin = isHRAdminEffective(profile);
  const [categories, featuredArticles] = await Promise.all([
    fetchCategoriesWithClient(supabase),
    fetchFeaturedArticles(supabase),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resources"
        subtitle="Policies, guides, and reference materials"
        breadcrumbs={[
          { label: "Home", href: "/intranet" },
          { label: "Resources" },
        ]}
      />

      <FeaturedResources articles={featuredArticles} />
      <ResourcesGrid categories={categories} isHRAdmin={isHRAdmin} />
    </div>
  );
}
