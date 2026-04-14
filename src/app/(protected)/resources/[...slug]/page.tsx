import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  isHRAdminEffective,
  isContentEditorEffective,
} from "@/lib/auth";
import {
  fetchCategoryBySlugPath,
  fetchGroupedSubcategoryArticles,
  fetchCategoryArticlesWithClient,
} from "../actions";
import { CategoryContent } from "@/components/resources/category-content";

interface CategoryPageProps {
  params: Promise<{ slug: string[] }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const canEdit =
    isHRAdminEffective(profile) || isContentEditorEffective(profile);
  // Draft visibility is content-editor-only; HR admins without editor flag
  // see the same view as readers. Fixes the inverted-governance audit bug.
  const canViewDrafts = isContentEditorEffective(profile);

  // Resolve slug path to category
  const result = await fetchCategoryBySlugPath(supabase, slug);

  // Old-format article URL redirect (e.g. /resources/policies/annual-leave)
  if (result.articleRedirectSlug) {
    redirect(`/resources/article/${result.articleRedirectSlug}`);
  }

  if (!result.category) notFound();

  const { category, ancestors } = result;
  const slugPath = slug.join("/");

  // Fetch grouped subcategory articles and direct articles in parallel
  const [subcategoryGroups, { articles: directArticles }] = await Promise.all([
    fetchGroupedSubcategoryArticles(supabase, category.id, canViewDrafts),
    fetchCategoryArticlesWithClient(supabase, category.slug, canViewDrafts),
  ]);

  return (
    <CategoryContent
      category={category}
      categorySlugPath={slugPath}
      ancestors={ancestors}
      subcategoryGroups={subcategoryGroups}
      directArticles={directArticles}
      canEdit={canEdit}
    />
  );
}
