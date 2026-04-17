import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  isHRAdminEffective,
  isContentEditorEffective,
} from "@/lib/auth";
import { fetchArticleBySlugOnly, fetchSiblingArticles, fetchUserBookmarkIds } from "../../actions";
import { logger } from "@/lib/logger";
import { COMPONENT_REGISTRY } from "@/lib/resource-components";
import { GoogleDocArticleView } from "@/components/resources/google-doc-article-view";
import { ComponentArticleView } from "@/components/resources/component-article-view";
import { NativeArticleView } from "@/components/resources/native-article-view";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const canEdit =
    isHRAdminEffective(profile) || isContentEditorEffective(profile);
  const canViewDrafts = isContentEditorEffective(profile);

  const { article, category, parentCategory } =
    await fetchArticleBySlugOnly(supabase, slug, canViewDrafts);

  if (!article || !category) notFound();

  const [siblings, bookmarkIds] = await Promise.all([
    fetchSiblingArticles(supabase, category.id),
    fetchUserBookmarkIds(supabase, user.id),
  ]);

  // eslint-disable-next-line react-hooks/purity
  const serverNow = Date.now();
  const categoryPath = parentCategory
    ? `${parentCategory.slug}/${category.slug}`
    : category.slug;
  const isBookmarked = bookmarkIds.has(article.id);

  if (article.content_type === "google_doc") {
    const crossLinkMap: Record<string, string> = {};
    const { data: crossLinks, error: crossLinkError } = await supabase
      .from("resource_articles")
      .select("google_doc_id, slug")
      .not("google_doc_id", "is", null)
      .is("deleted_at", null)
      .eq("status", "published");

    if (crossLinkError) {
      logger.error("Failed to fetch cross-link map", { error: crossLinkError.message });
    }

    if (crossLinks) {
      for (const row of crossLinks) {
        if (row.google_doc_id) crossLinkMap[row.google_doc_id] = row.slug;
      }
    }

    return (
      <GoogleDocArticleView
        article={article}
        category={category}
        parentCategory={parentCategory}
        canEdit={canEdit}
        isBookmarked={isBookmarked}
        siblings={siblings}
        categoryPath={categoryPath}
        serverNow={serverNow}
        crossLinkMap={crossLinkMap}
      />
    );
  }

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
        isBookmarked={isBookmarked}
        componentData={componentData}
      />
    );
  }

  return (
    <NativeArticleView
      article={article}
      category={category}
      parentCategory={parentCategory}
      canEdit={canEdit}
      isBookmarked={isBookmarked}
      siblings={siblings}
      categoryPath={categoryPath}
      serverNow={serverNow}
    />
  );
}
