import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  isHRAdminEffective,
  isContentEditorEffective,
} from "@/lib/auth";
import { fetchArticleBySlugOnly, fetchSiblingArticles } from "../../actions";
import { COMPONENT_REGISTRY } from "@/lib/resource-components";
import { GoogleDocArticleView } from "@/components/resources/google-doc-article-view";
import { ComponentArticleView } from "@/components/resources/component-article-view";
import { NativeArticleView } from "@/components/resources/native-article-view";
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

  // Fetch sibling articles for "More in [folder]" section
  const siblings = await fetchSiblingArticles(supabase, category.id);
  const serverNow = Date.now();
  const categoryPath = parentCategory
    ? `${parentCategory.slug}/${category.slug}`
    : category.slug;

  // Google Doc articles — renders synced HTML with sync controls
  if (article.content_type === "google_doc") {
    return (
      <GoogleDocArticleView
        article={article}
        category={category}
        parentCategory={parentCategory}
        canEdit={canEdit}
        siblings={siblings}
        categoryPath={categoryPath}
        serverNow={serverNow}
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

  // Native Plate articles — renders content_json via PlateStatic
  if ((article as { content_type: string }).content_type === "native") {
    return (
      <NativeArticleView
        article={article}
        category={category}
        parentCategory={parentCategory}
        canEdit={canEdit}
        siblings={siblings}
        categoryPath={categoryPath}
        serverNow={serverNow}
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
