import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  isHRAdminEffective,
  isContentEditorEffective,
} from "@/lib/auth";
import { fetchArticleBySlugOnly } from "../../actions";
import { GoogleDocArticleView } from "@/components/resources/google-doc-article-view";
import { ArticleView } from "@/components/resources/article-view";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const canEdit =
    isHRAdminEffective(profile) || isContentEditorEffective(profile);

  const { article, category, parentCategory } =
    await fetchArticleBySlugOnly(supabase, slug, canEdit);

  if (!article || !category) notFound();

  // Google Doc articles use the new view with sync controls
  if (article.content_type === "google_doc") {
    return (
      <GoogleDocArticleView
        article={article}
        category={category}
        parentCategory={parentCategory}
        canEdit={canEdit}
      />
    );
  }

  // Component pages and legacy articles use the existing view
  return (
    <ArticleView
      article={article}
      categoryId={category.id}
      categorySlug={category.slug}
      canEdit={canEdit}
    />
  );
}
