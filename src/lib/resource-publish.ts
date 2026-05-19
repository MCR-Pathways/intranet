/**
 * Shared publish + reindex helpers for native Resources articles.
 *
 * Used by:
 *  - src/app/(protected)/resources/native-actions.ts (server actions —
 *    requires auth, wraps these helpers)
 *  - scripts/migrate-wp-page.ts (WP migration — uses service-role client
 *    directly, no auth wrapper)
 *
 * Extracted out of native-actions.ts so the migration script can reuse
 * the publish + Algolia indexing logic without going through a "use server"
 * boundary or duplicating the 20-line block.
 */
import type { Value } from "platejs";
import { serializeHtml } from "platejs/static";
import { createNativeStaticEditor } from "@/lib/plate-static-plugins";
import { indexArticleSections, removeArticleFromIndex } from "@/lib/algolia";
import { parseHtmlIntoSections } from "@/lib/html-sections";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

/**
 * Serialise Plate JSON to HTML for synced_html storage and Algolia indexing.
 * Returns "" for empty/missing content (callers clear synced_html + Algolia).
 * Returns null only on serialisation error (callers skip update to avoid data loss).
 */
export async function serialiseContentToHtml(
  contentJson: unknown,
): Promise<string | null> {
  if (!contentJson || !Array.isArray(contentJson) || contentJson.length === 0) {
    return "";
  }
  try {
    const editor = createNativeStaticEditor(contentJson as Value);
    const fullHtml = await serializeHtml(editor, { stripDataAttributes: true });
    // Strip Plate's <div class="slate-editor"> wrapper so headings are
    // top-level for parseHtmlIntoSections (Algolia section extraction).
    const trimmed = fullHtml.trim();
    const match = trimmed.match(/^<div[^>]*>([\s\S]*)<\/div>$/);
    return match ? match[1] : trimmed;
  } catch (err) {
    logger.error("Failed to serialise native content to HTML", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Publish a native article and index it in Algolia.
 *
 * Sets status='published', persists synced_html, indexes article sections
 * in Algolia. Does NOT call revalidatePath — callers in a request context
 * (server actions) should revalidate themselves; the migration script
 * doesn't need to.
 */
export async function publishAndIndex(
  articleId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { data: article, error } = await supabase
    .from("resource_articles")
    .update({
      status: "published",
      last_published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId)
    .eq("content_type", "native")
    .select(
      "id, title, slug, content_json, resource_categories!category_id(name, slug)",
    )
    .single();

  if (error || !article) {
    logger.error("Failed to publish native article", {
      error: error?.message,
      articleId,
    });
    return { success: false, error: "Failed to publish" };
  }

  try {
    const html = await serialiseContentToHtml(article.content_json);

    if (html === null) {
      // Serialisation error — skip synced_html update to avoid data loss
    } else {
      const { error: syncError } = await supabase
        .from("resource_articles")
        .update({ synced_html: html || null })
        .eq("id", articleId)
        .eq("content_type", "native");

      if (syncError) {
        logger.error("Failed to persist synced_html on publish", {
          error: syncError.message,
          articleId,
        });
      }

      if (html) {
        const cat = article.resource_categories as unknown as {
          name: string;
          slug: string;
        } | null;
        const sections = parseHtmlIntoSections(html);
        await indexArticleSections(
          article.id,
          article.slug,
          article.title,
          "native",
          cat?.name ?? "",
          cat?.slug ?? "",
          sections,
          new Date().toISOString(),
        );
      } else {
        await removeArticleFromIndex(articleId);
      }
    }
  } catch (err) {
    logger.error("Algolia indexing failed on publish", {
      error: err instanceof Error ? err.message : String(err),
      articleId,
    });
    // Don't fail the publish — Algolia is non-critical
  }

  return { success: true };
}
