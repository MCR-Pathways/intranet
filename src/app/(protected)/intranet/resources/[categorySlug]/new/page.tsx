import { redirect, notFound } from "next/navigation";
import { getCurrentUser, isHRAdminEffective, isContentEditorEffective } from "@/lib/auth";
import { fetchCategoryBySlugWithClient } from "../../actions";
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
    redirect(`/intranet/resources/${categorySlug}`);
  }

  const category = await fetchCategoryBySlugWithClient(supabase, categorySlug);
  if (!category) notFound();

  return <ArticleEditorPage category={category} />;
}
