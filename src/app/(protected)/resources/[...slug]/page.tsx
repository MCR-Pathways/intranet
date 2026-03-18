import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  isHRAdminEffective,
  isContentEditorEffective,
} from "@/lib/auth";
import {
  fetchCategoryBySlugPath,
  fetchSubcategoriesWithClient,
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

  // Resolve slug path to category
  const result = await fetchCategoryBySlugPath(supabase, slug);

  // Old-format article URL redirect (e.g. /resources/policies/annual-leave)
  if (result.articleRedirectSlug) {
    redirect(`/resources/article/${result.articleRedirectSlug}`);
  }

  if (!result.category) notFound();

  const { category, ancestors } = result;
  const slugPath = slug.join("/");

  // Fetch subcategories and articles in parallel
  const [subcategories, { articles }] = await Promise.all([
    fetchSubcategoriesWithClient(supabase, category.id),
    fetchCategoryArticlesWithClient(supabase, category.slug, canEdit),
  ]);

  return (
    <CategoryContent
      category={category}
      categorySlugPath={slugPath}
      ancestors={ancestors}
      subcategories={subcategories}
      articles={articles}
      canEdit={canEdit}
    />
  );
}
