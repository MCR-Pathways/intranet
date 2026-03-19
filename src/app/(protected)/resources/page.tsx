import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  fetchFeaturedArticles,
  fetchRecentlyUpdatedArticles,
  fetchCategoryTreeWithClient,
} from "./actions";
import { ResourcesLanding } from "@/components/resources/resources-landing";

export default async function ResourcesPage() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const [featuredArticles, recentArticles, categories] = await Promise.all([
    fetchFeaturedArticles(supabase),
    fetchRecentlyUpdatedArticles(supabase),
    fetchCategoryTreeWithClient(supabase),
  ]);

  return (
    <ResourcesLanding
      featuredArticles={featuredArticles}
      recentArticles={recentArticles}
      categories={categories}
    />
  );
}
