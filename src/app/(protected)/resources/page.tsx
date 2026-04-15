import { redirect } from "next/navigation";
import {
  getCurrentUser,
  isHRAdminEffective,
  isContentEditorEffective,
} from "@/lib/auth";
import {
  fetchFeaturedArticles,
  fetchRecentlyUpdatedArticles,
  fetchCategoryTreeWithClient,
  fetchDraftCount,
} from "./actions";
import { ResourcesLanding } from "@/components/resources/resources-landing";

export default async function ResourcesPage() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const canEdit =
    isHRAdminEffective(profile) || isContentEditorEffective(profile);

  const [featuredArticles, recentArticles, categories, draftCount] =
    await Promise.all([
      fetchFeaturedArticles(supabase),
      fetchRecentlyUpdatedArticles(supabase),
      fetchCategoryTreeWithClient(supabase),
      // Readers always get 0 via RLS; skip the round-trip.
      canEdit ? fetchDraftCount(supabase) : Promise.resolve(0),
    ]);

  return (
    <ResourcesLanding
      featuredArticles={featuredArticles}
      recentArticles={recentArticles}
      categories={categories}
      canEdit={canEdit}
      draftCount={draftCount}
    />
  );
}
