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
  // Draft visibility is content-editor-only; HR admins without editor flag
  // see the same view as readers (no drafts pill, no draft-inclusive counts).
  const canViewDrafts = isContentEditorEffective(profile);

  const [featuredArticles, recentArticles, categories, draftCount] =
    await Promise.all([
      fetchFeaturedArticles(supabase),
      fetchRecentlyUpdatedArticles(supabase),
      fetchCategoryTreeWithClient(supabase, canViewDrafts),
      canViewDrafts ? fetchDraftCount(supabase) : Promise.resolve(0),
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
