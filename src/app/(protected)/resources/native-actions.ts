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

// =============================================
// CREATE NATIVE ARTICLE
// =============================================

export async function createNativeArticle(
  title: string,
  categoryId: string
): Promise<{ success: boolean; slug?: string; error?: string }> {
  try {
    const { profile } = await requireContentEditor();

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
        author_id: profile.id,
      })
      .select("slug")
      .single();

    if (error || !article) {
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
        content_json: contentJson,
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
    const { profile } = await requireContentEditor();
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
    const isSomeoneElse = editingBy && editingBy !== profile.id && !isStale;

    // Update editing status to current user
    await supabase
      .from("resource_articles")
      .update({
        editing_by: profile.id,
        editing_at: now.toISOString(),
      })
      .eq("id", articleId);

    if (isSomeoneElse) {
      const editorProfile = article?.profiles as { full_name: string } | null;
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
      .select("id, title, slug, resource_categories!category_id(slug, parent_id, resource_categories!parent_id(slug))")
      .ilike("title", `%${sanitised}%`)
      .is("deleted_at", null)
      .eq("status", "published")
      .limit(10);

    if (error || !data) return [];

    return data.map((article) => {
      const category = article.resource_categories as unknown as {
        slug: string;
        parent_id: string | null;
        resource_categories: { slug: string } | null;
      };
      return {
        id: article.id,
        title: article.title,
        slug: article.slug,
        categorySlug: category?.slug ?? "",
        parentCategorySlug: category?.resource_categories?.slug,
      };
    });
  } catch {
    return [];
  }
}
