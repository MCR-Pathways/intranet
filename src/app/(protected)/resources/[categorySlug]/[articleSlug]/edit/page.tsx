import { redirect, notFound } from "next/navigation";
import { getCurrentUser, isHRAdminEffective, isContentEditorEffective } from "@/lib/auth";
import { fetchArticleWithClient } from "../../../actions";
import { ArticleEditorPage } from "@/components/resources/article-editor-page";

interface EditArticlePageProps {
  params: Promise<{ categorySlug: string; articleSlug: string }>;
}

export default async function EditArticlePage({
  params,
}: EditArticlePageProps) {
  const { categorySlug, articleSlug } = await params;
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  // Only editors (HR admins or content editors) can edit articles
  if (!isHRAdminEffective(profile) && !isContentEditorEffective(profile)) {
    redirect(`/resources/${categorySlug}/${articleSlug}`);
  }

  const { category, article } = await fetchArticleWithClient(
    supabase,
    categorySlug,
    articleSlug,
    true // isHRAdmin — we've already checked above
  );

  if (!category || !article) notFound();

  return <ArticleEditorPage category={category} article={article} />;
}
