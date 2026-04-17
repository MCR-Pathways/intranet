"use server";

/**
 * Server actions for native Plate articles.
 *
 * Separate from actions.ts (1,243 lines) per CLAUDE.md convention
 * to split at ~800 lines.
 */

import { revalidatePath } from "next/cache";
import { requireContentEditor } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";
import type { Value } from "platejs";
import { serializeHtml } from "platejs/static";
import { createNativeStaticEditor } from "@/lib/plate-static-plugins";
import { indexArticleSections, removeArticleFromIndex } from "@/lib/algolia";
import { parseHtmlIntoSections } from "@/lib/html-sections";
import { logger } from "@/lib/logger";

// =============================================
// CONSTANTS
// =============================================

const RESERVED_SLUGS = new Set(["new", "edit", "bin", "settings", "article"]);

const EMPTY_PLATE_VALUE = [{ type: "p", children: [{ text: "" }] }];

// =============================================
// HELPERS
// =============================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureUniqueSlug(
  supabase: ReturnType<typeof createServiceClient>,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;

  while (RESERVED_SLUGS.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  while (true) {
    const { data } = await supabase
      .from("resource_articles")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (!data || data.length === 0) break;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  return slug;
}

function revalidate() {
  revalidatePath("/resources", "layout");
}

/**
 * Serialise Plate JSON to HTML for Algolia indexing and synced_html storage.
 * Returns "" for empty/missing content (callers should clear synced_html + Algolia).
 * Returns null only on serialisation error (callers should skip update to avoid data loss).
 */
async function serialiseContentToHtml(contentJson: unknown): Promise<string | null> {
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

// =============================================
// CREATE NATIVE ARTICLE
// =============================================

export async function createNativeArticle(
  title: string,
  categoryId: string
): Promise<{ success: boolean; slug?: string; error?: string }> {
  try {
    const { user } = await requireContentEditor();

    if (!title.trim()) {
      return { success: false, error: "Title is required" };
    }

    if (title.trim().length > 200) {
      return { success: false, error: "Title must be 200 characters or fewer" };
    }

    if (!categoryId) {
      return { success: false, error: "Category is required" };
    }

    const supabase = createServiceClient();
    const slug = await ensureUniqueSlug(supabase, slugify(title.trim()));

    const { data: article, error } = await supabase
      .from("resource_articles")
      .insert({
        title: title.trim(),
        slug,
        category_id: categoryId,
        content_type: "native",
        content_json: EMPTY_PLATE_VALUE,
        content: "",
        status: "draft",
        author_id: user.id,
      })
      .select("slug")
      .single();

    if (error || !article) {
      // Postgres unique-violation (23505) means a concurrent creation beat us
      // to this slug despite the ensureUniqueSlug pre-check. Surface a clear
      // message so the editor knows to retry with a different title.
      if (error?.code === "23505") {
        return {
          success: false,
          error: "A resource with this slug already exists — try a different title.",
        };
      }
      logger.error("Failed to create native article", { error: error?.message });
      return { success: false, error: "Failed to create article" };
    }

    revalidate();
    return { success: true, slug: article.slug };
  } catch (error) {
    logger.error("createNativeArticle error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to create article" };
  }
}

// =============================================
// SAVE NATIVE ARTICLE (AUTO-SAVE)
// =============================================

export async function saveNativeArticle(
  articleId: string,
  contentJson: Record<string, unknown>[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireContentEditor();

    if (!articleId) {
      return { success: false, error: "Article ID is required" };
    }

    const supabase = createServiceClient();

    const { error } = await supabase
      .from("resource_articles")
      .update({
        content_json: contentJson as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId)
      .eq("content_type", "native");

    if (error) {
      logger.error("Failed to save native article", { error: error.message, articleId });
      return { success: false, error: "Failed to save" };
    }

    // Note: synced_html serialisation and Algolia indexing are deferred
    // to a separate reindexNativeArticle action (called on 30s idle or publish)

    return { success: true };
  } catch (error) {
    logger.error("saveNativeArticle error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to save" };
  }
}

// =============================================
// UPDATE EDITING STATUS (CONCURRENT EDITING)
// =============================================

export async function updateEditingStatus(
  articleId: string
): Promise<{ editingBy?: string; editingAt?: string }> {
  try {
    const { user } = await requireContentEditor();
    const supabase = createServiceClient();

    // Check if someone else is editing (within last 30 seconds)
    const { data: article } = await supabase
      .from("resource_articles")
      .select("editing_by, editing_at, profiles!editing_by(full_name)")
      .eq("id", articleId)
      .single();

    const now = new Date();
    const editingAt = article?.editing_at ? new Date(article.editing_at as string) : null;
    const isStale = !editingAt || now.getTime() - editingAt.getTime() > 30_000;
    const editingBy = article?.editing_by as string | null;
    const isSomeoneElse = editingBy && editingBy !== user.id && !isStale;

    // Update editing status to current user
    await supabase
      .from("resource_articles")
      .update({
        editing_by: user.id,
        editing_at: now.toISOString(),
      })
      .eq("id", articleId);

    if (isSomeoneElse) {
      const editorProfile = article?.profiles as unknown as { full_name: string } | null;
      return {
        editingBy: editorProfile?.full_name ?? "Someone",
        editingAt: article?.editing_at as string,
      };
    }

    return {};
  } catch {
    return {};
  }
}

// =============================================
// PUBLISH / UNPUBLISH
// =============================================

export async function publishNativeArticle(
  articleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireContentEditor();
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
      .select("id, title, slug, content_json, resource_categories!category_id(name, slug)")
      .single();

    if (error || !article) {
      logger.error("Failed to publish native article", { error: error?.message, articleId });
      return { success: false, error: "Failed to publish" };
    }

    // Generate synced_html from content_json and index in Algolia
    try {
      const html = await serialiseContentToHtml(article.content_json);

      if (html === null) {
        // Serialisation error — skip update to avoid data loss
      } else {
        // Persist synced_html (empty string clears stale data)
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
          const cat = article.resource_categories as unknown as { name: string; slug: string } | null;
          const sections = parseHtmlIntoSections(html);
          await indexArticleSections(
            article.id,
            article.slug,
            article.title,
            "native",
            cat?.name ?? "",
            cat?.slug ?? "",
            sections,
            new Date().toISOString()
          );
        } else {
          // Content cleared — remove stale search index
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

    revalidate();
    return { success: true };
  } catch (error) {
    logger.error("publishNativeArticle error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to publish" };
  }
}

export async function unpublishNativeArticle(
  articleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireContentEditor();
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("resource_articles")
      .update({
        status: "draft",
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId)
      .eq("content_type", "native");

    if (error) {
      logger.error("Failed to unpublish native article", { error: error.message, articleId });
      return { success: false, error: "Failed to unpublish" };
    }

    // Remove from Algolia
    try {
      await removeArticleFromIndex(articleId);
    } catch (err) {
      logger.error("Algolia removal failed on unpublish", {
        error: err instanceof Error ? err.message : String(err),
        articleId,
      });
    }

    revalidate();
    return { success: true };
  } catch (error) {
    logger.error("unpublishNativeArticle error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to unpublish" };
  }
}

// =============================================
// REINDEX (CALLED ON 30s IDLE OR PUBLISH)
// =============================================

export async function reindexNativeArticle(
  articleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireContentEditor();
    const supabase = createServiceClient();

    const { data: article, error } = await supabase
      .from("resource_articles")
      .select("id, title, slug, content_json, status, resource_categories!category_id(name, slug)")
      .eq("id", articleId)
      .eq("content_type", "native")
      .single();

    if (error || !article) {
      return { success: false, error: "Article not found" };
    }

    // Only index published articles
    if (article.status !== "published") {
      return { success: true };
    }

    // Generate HTML from content_json
    const html = await serialiseContentToHtml(article.content_json);

    if (html === null) {
      // Serialisation error — skip update to avoid data loss
      return { success: true };
    }

    // Persist synced_html (empty string clears stale data)
    const { error: syncError } = await supabase
      .from("resource_articles")
      .update({ synced_html: html || null })
      .eq("id", articleId)
      .eq("content_type", "native");

    if (syncError) {
      logger.error("Failed to persist synced_html on reindex", {
        error: syncError.message,
        articleId,
      });
    }

    if (!html) {
      // Content cleared — remove stale search index
      try { await removeArticleFromIndex(articleId); } catch { /* non-critical */ }
      return { success: true };
    }

    const cat = article.resource_categories as unknown as { name: string; slug: string } | null;
    const sections = parseHtmlIntoSections(html);
    await indexArticleSections(
      article.id,
      article.slug,
      article.title,
      "native",
      cat?.name ?? "",
      cat?.slug ?? "",
      sections,
      new Date().toISOString()
    );

    return { success: true };
  } catch (error) {
    logger.error("reindexNativeArticle error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to reindex" };
  }
}

// =============================================
// SEARCH ARTICLES (FOR LINK INSERTION)
// =============================================

export async function searchArticlesForLink(
  query: string
): Promise<Array<{ id: string; title: string; slug: string; categorySlug: string; parentCategorySlug?: string }>> {
  try {
    await requireContentEditor();

    if (!query.trim() || query.trim().length < 2) return [];

    const supabase = createServiceClient();
    const sanitised = query.trim().replace(/[,%_\\.()\"']/g, "");

    const { data, error } = await supabase
      .from("resource_articles")
      .select("id, title, slug, resource_categories!category_id(slug, parent:parent_id(slug))")
      .ilike("title", `%${sanitised}%`)
      .is("deleted_at", null)
      .eq("status", "published")
      .limit(10);

    if (error || !data) return [];

    return data.map((article) => {
      const category = article.resource_categories as unknown as {
        slug: string;
        parent: { slug: string } | null;
      };
      return {
        id: article.id,
        title: article.title,
        slug: article.slug,
        categorySlug: category?.slug ?? "",
        parentCategorySlug: category?.parent?.slug,
      };
    });
  } catch {
    return [];
  }
}
