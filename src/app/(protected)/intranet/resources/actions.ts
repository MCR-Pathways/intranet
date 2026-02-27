"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireHRAdmin } from "@/lib/auth";
import { extractPlainText } from "@/lib/tiptap";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TiptapDocument } from "@/lib/tiptap";
import type {
  ArticleWithAuthor,
  CategoryWithCount,
  ResourceCategory,
  ResourceArticle,
} from "@/types/database.types";

// ─── SELECT constants ────────────────────────────────────────────────────────

const CATEGORY_SELECT =
  "id, name, slug, description, icon, sort_order, created_at, updated_at";

const ARTICLE_SELECT =
  "id, category_id, title, slug, content, content_json, status, author_id, created_at, updated_at, published_at";

const AUTHOR_SELECT = "id, full_name, preferred_name, avatar_url";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureUniqueCategorySlug(
  supabase: SupabaseClient,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const query = supabase
      .from("resource_categories")
      .select("id")
      .eq("slug", slug);
    if (excludeId) query.neq("id", excludeId);
    const { data } = await query.limit(1);
    if (!data || data.length === 0) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
}

async function ensureUniqueArticleSlug(
  supabase: SupabaseClient,
  categoryId: string,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const query = supabase
      .from("resource_articles")
      .select("id")
      .eq("category_id", categoryId)
      .eq("slug", slug);
    if (excludeId) query.neq("id", excludeId);
    const { data } = await query.limit(1);
    if (!data || data.length === 0) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
}

function revalidate() {
  revalidatePath("/intranet/resources", "layout");
}

// ─── Read helpers (*WithClient) ──────────────────────────────────────────────

export async function fetchCategoriesWithClient(
  supabase: SupabaseClient
): Promise<CategoryWithCount[]> {
  // Fetch categories with article count via Supabase relation count
  const { data, error } = await supabase
    .from("resource_categories")
    .select(`${CATEGORY_SELECT}, resource_articles(count)`)
    .order("sort_order")
    .order("name");

  if (error || !data) return [];

  return data.map((cat: Record<string, unknown>) => {
    const articles = cat.resource_articles as
      | [{ count: number }]
      | undefined;
    const articleCount = articles?.[0]?.count ?? 0;
    // Remove the nested relation from the returned object
    const { resource_articles: _, ...category } = cat;
    return { ...category, article_count: articleCount } as CategoryWithCount;
  });
}

export async function fetchCategoryArticlesWithClient(
  supabase: SupabaseClient,
  categorySlug: string,
  isHRAdmin: boolean
): Promise<{
  category: ResourceCategory | null;
  articles: ArticleWithAuthor[];
}> {
  // Fetch category by slug
  const { data: category, error: catError } = await supabase
    .from("resource_categories")
    .select(CATEGORY_SELECT)
    .eq("slug", categorySlug)
    .single();

  if (catError || !category) {
    return { category: null, articles: [] };
  }

  // Fetch articles for this category (belt-and-suspenders: filter by status for non-admins)
  let query = supabase
    .from("resource_articles")
    .select(`${ARTICLE_SELECT}, author:profiles!author_id(${AUTHOR_SELECT})`)
    .eq("category_id", category.id)
    .order("updated_at", { ascending: false });

  if (!isHRAdmin) {
    query = query.eq("status", "published");
  }

  const { data: articles, error: artError } = await query;

  if (artError || !articles) {
    return { category: category as ResourceCategory, articles: [] };
  }

  return {
    category: category as ResourceCategory,
    articles: articles as unknown as ArticleWithAuthor[],
  };
}

export async function fetchArticleWithClient(
  supabase: SupabaseClient,
  categorySlug: string,
  articleSlug: string,
  isHRAdmin: boolean
): Promise<{
  category: ResourceCategory | null;
  article: ArticleWithAuthor | null;
}> {
  // Fetch category by slug
  const { data: category, error: catError } = await supabase
    .from("resource_categories")
    .select(CATEGORY_SELECT)
    .eq("slug", categorySlug)
    .single();

  if (catError || !category) {
    return { category: null, article: null };
  }

  // Fetch single article
  let query = supabase
    .from("resource_articles")
    .select(`${ARTICLE_SELECT}, author:profiles!author_id(${AUTHOR_SELECT})`)
    .eq("category_id", category.id)
    .eq("slug", articleSlug);

  if (!isHRAdmin) {
    query = query.eq("status", "published");
  }

  const { data: article, error: artError } = await query.single();

  if (artError || !article) {
    return { category: category as ResourceCategory, article: null };
  }

  return {
    category: category as ResourceCategory,
    article: article as unknown as ArticleWithAuthor,
  };
}

// ─── Category mutations ──────────────────────────────────────────────────────

export async function createCategory(data: {
  name: string;
  description?: string;
  icon?: string;
}): Promise<{ success: boolean; error?: string; category?: ResourceCategory }> {
  const { supabase } = await requireHRAdmin();

  const name = data.name?.trim();
  if (!name) {
    return { success: false, error: "Category name is required" };
  }

  const baseSlug = slugify(name);
  if (!baseSlug) {
    return { success: false, error: "Invalid category name" };
  }

  const slug = await ensureUniqueCategorySlug(supabase, baseSlug);

  // Get next sort order
  const { data: maxRow } = await supabase
    .from("resource_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data: category, error } = await supabase
    .from("resource_categories")
    .insert({
      name,
      slug,
      description: data.description?.trim() || null,
      icon: data.icon || null,
      sort_order: sortOrder,
    })
    .select(CATEGORY_SELECT)
    .single();

  if (error) {
    return { success: false, error: "Failed to create category" };
  }

  revalidate();
  return { success: true, category: category as ResourceCategory };
}

export async function updateCategory(
  id: string,
  data: {
    name?: string;
    description?: string;
    icon?: string;
    sort_order?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireHRAdmin();

  // Whitelist allowed fields
  const update: Record<string, unknown> = {};

  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) return { success: false, error: "Category name is required" };
    update.name = name;

    // Update slug if name changed
    const baseSlug = slugify(name);
    if (baseSlug) {
      update.slug = await ensureUniqueCategorySlug(supabase, baseSlug, id);
    }
  }
  if (data.description !== undefined) {
    update.description = data.description.trim() || null;
  }
  if (data.icon !== undefined) {
    update.icon = data.icon || null;
  }
  if (data.sort_order !== undefined) {
    update.sort_order = data.sort_order;
  }

  if (Object.keys(update).length === 0) {
    return { success: false, error: "No changes provided" };
  }

  const { error } = await supabase
    .from("resource_categories")
    .update(update)
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Failed to update category" };
  }

  revalidate();
  return { success: true };
}

export async function deleteCategory(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireHRAdmin();

  const { error } = await supabase
    .from("resource_categories")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Failed to delete category" };
  }

  revalidate();
  return { success: true };
}

export async function getCategoryArticleCount(
  id: string
): Promise<number> {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) return 0;

  const { count } = await supabase
    .from("resource_articles")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  return count ?? 0;
}

// ─── Article mutations ───────────────────────────────────────────────────────

export async function createArticle(
  categoryId: string,
  data: {
    title: string;
    content_json?: TiptapDocument;
    status?: "draft" | "published";
  }
): Promise<{
  success: boolean;
  error?: string;
  article?: ResourceArticle;
}> {
  const { supabase, user } = await requireHRAdmin();

  const title = data.title?.trim();
  if (!title) {
    return { success: false, error: "Article title is required" };
  }

  const baseSlug = slugify(title);
  if (!baseSlug) {
    return { success: false, error: "Invalid article title" };
  }

  const slug = await ensureUniqueArticleSlug(supabase, categoryId, baseSlug);

  // Extract plain text from Tiptap JSON for search indexing
  const content = data.content_json
    ? extractPlainText(data.content_json)
    : "";

  const status = data.status ?? "draft";

  const insert: Record<string, unknown> = {
    category_id: categoryId,
    title,
    slug,
    content,
    author_id: user.id,
    status,
  };

  if (data.content_json) {
    insert.content_json = data.content_json;
  }

  if (status === "published") {
    insert.published_at = new Date().toISOString();
  }

  const { data: article, error } = await supabase
    .from("resource_articles")
    .insert(insert)
    .select(ARTICLE_SELECT)
    .single();

  if (error) {
    return { success: false, error: "Failed to create article" };
  }

  revalidate();
  return { success: true, article: article as ResourceArticle };
}

export async function updateArticle(
  id: string,
  data: {
    title?: string;
    content_json?: TiptapDocument;
    status?: "draft" | "published";
  }
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireHRAdmin();

  const update: Record<string, unknown> = {};

  if (data.title !== undefined) {
    const title = data.title.trim();
    if (!title) return { success: false, error: "Article title is required" };
    update.title = title;

    // Need category_id to check slug uniqueness — fetch current article
    const { data: current } = await supabase
      .from("resource_articles")
      .select("category_id")
      .eq("id", id)
      .single();

    if (current) {
      const baseSlug = slugify(title);
      if (baseSlug) {
        update.slug = await ensureUniqueArticleSlug(
          supabase,
          current.category_id,
          baseSlug,
          id
        );
      }
    }
  }

  if (data.content_json !== undefined) {
    update.content_json = data.content_json;
    update.content = extractPlainText(data.content_json);
  }

  if (data.status !== undefined) {
    update.status = data.status;
    if (data.status === "published") {
      // Only set published_at on first publish (check if already set)
      const { data: current } = await supabase
        .from("resource_articles")
        .select("published_at")
        .eq("id", id)
        .single();

      if (!current?.published_at) {
        update.published_at = new Date().toISOString();
      }
    }
  }

  if (Object.keys(update).length === 0) {
    return { success: false, error: "No changes provided" };
  }

  const { error } = await supabase
    .from("resource_articles")
    .update(update)
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Failed to update article" };
  }

  revalidate();
  return { success: true };
}

export async function deleteArticle(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireHRAdmin();

  const { error } = await supabase
    .from("resource_articles")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Failed to delete article" };
  }

  revalidate();
  return { success: true };
}
