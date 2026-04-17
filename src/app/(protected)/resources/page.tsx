import { redirect } from "next/navigation";
import {
  getCurrentUser,
  isHRAdminEffective,
  isContentEditorEffective,
} from "@/lib/auth";
import {
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
  const canViewDrafts = isContentEditorEffective(profile);

  const [recentArticles, categories, draftCount] = await Promise.all([
    fetchRecentlyUpdatedArticles(supabase),
    fetchCategoryTreeWithClient(supabase, canViewDrafts),
    canViewDrafts ? fetchDraftCount(supabase) : Promise.resolve(0),
  ]);

  return (
    <ResourcesLanding
      recentArticles={recentArticles}
      categories={categories}
      canEdit={canEdit}
      draftCount={draftCount}
    />
  );
}
