import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  isHRAdminEffective,
  isContentEditorEffective,
} from "@/lib/auth";
import { fetchArticleBySlugOnly } from "../../actions";
import { COMPONENT_REGISTRY } from "@/lib/resource-components";
import { GoogleDocArticleView } from "@/components/resources/google-doc-article-view";
import { ComponentArticleView } from "@/components/resources/component-article-view";
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

  // Google Doc articles — renders synced HTML with sync controls
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

  // Component pages — renders registered React component with fetched data
  if (
    article.content_type === "component" &&
    article.component_name &&
    COMPONENT_REGISTRY[article.component_name]
  ) {
    const entry = COMPONENT_REGISTRY[article.component_name];
    const componentData = (await entry.getData(
      supabase,
      user.id
    )) as Record<string, unknown>;

    return (
      <ComponentArticleView
        article={article}
        category={category}
        parentCategory={parentCategory}
        componentData={componentData}
      />
    );
  }

  // Legacy Tiptap articles (fallback)
  return (
    <ArticleView
      article={article}
      categoryId={category.id}
      categorySlug={category.slug}
      canEdit={canEdit}
    />
  );
}
