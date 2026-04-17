import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  isHRAdminEffective,
  isContentEditorEffective,
} from "@/lib/auth";
import { fetchArticleBySlugOnly, fetchSiblingArticles } from "../../actions";
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
  // Draft visibility is content-editor-only; HR admins without editor flag
  // get 404 on a draft slug, same as readers.
  const canViewDrafts = isContentEditorEffective(profile);

  const { article, category, parentCategory } =
    await fetchArticleBySlugOnly(supabase, slug, canViewDrafts);

  if (!article || !category) notFound();

  // Fetch sibling articles for "More in [folder]" section
  const siblings = await fetchSiblingArticles(supabase, category.id);
  // Server-rendered timestamp for freshness indicator. Date.now() in an async
  // Server Component generates a per-request value and is the intended pattern.
  // eslint-disable-next-line react-hooks/purity
  const serverNow = Date.now();
  const categoryPath = parentCategory
    ? `${parentCategory.slug}/${category.slug}`
    : category.slug;

  // Google Doc articles — renders synced HTML with sync controls
  if (article.content_type === "google_doc") {
    // Build cross-link map: google_doc_id → slug for published Google Docs
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
        siblings={siblings}
        categoryPath={categoryPath}
        serverNow={serverNow}
        crossLinkMap={crossLinkMap}
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

  // Native Plate articles (fallback for any non-google_doc, non-component type)
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
