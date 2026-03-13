import { redirect, notFound } from "next/navigation";
import { getCurrentUser, isHRAdminEffective, isContentEditorEffective } from "@/lib/auth";
import { fetchCategoryBySlugWithClient, fetchParentCategory } from "../../actions";
import { ArticleEditorPage } from "@/components/resources/article-editor-page";

interface NewArticlePageProps {
  params: Promise<{ categorySlug: string }>;
}

export default async function NewArticlePage({ params }: NewArticlePageProps) {
  const { categorySlug } = await params;
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  // Only editors (HR admins or content editors) can create articles
  if (!isHRAdminEffective(profile) && !isContentEditorEffective(profile)) {
    redirect(`/resources/${categorySlug}`);
  }

  const category = await fetchCategoryBySlugWithClient(supabase, categorySlug);
  if (!category) notFound();

  // Fetch parent category info for breadcrumbs if this is a subcategory
  const parentCategory = category.parent_id
    ? (await fetchParentCategory(supabase, category.parent_id)) ?? undefined
    : undefined;

  return <ArticleEditorPage category={category} parentCategory={parentCategory} />;
}
