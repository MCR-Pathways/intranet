"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireContentEditor } from "@/lib/auth";
import { extractPlainText } from "@/lib/tiptap";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TiptapDocument } from "@/lib/tiptap";
import type {
  ArticleWithAuthor,
  CategoryWithCount,
  CategoryWithChildren,
  CategoryTreeNode,
  ResourceCategory,
  ResourceArticle,
} from "@/types/database.types";

// ─── SELECT constants ────────────────────────────────────────────────────────

const CATEGORY_SELECT =
  "id, name, slug, description, icon, icon_colour, sort_order, parent_id, visibility, created_at, updated_at, deleted_at, deleted_by";

const ARTICLE_SELECT =
  "id, category_id, title, slug, content, content_json, status, author_id, created_at, updated_at, published_at, deleted_at, deleted_by, is_featured, featured_sort_order, visibility";

const MAX_FEATURED_ARTICLES = 3;

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
      .eq("slug", slug)
      .is("deleted_at", null);
    if (excludeId) query.neq("id", excludeId);
    const { data } = await query.limit(1);
    if (!data || data.length === 0) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
}

/** Slugs reserved for Next.js routes — articles cannot use these. */
const RESERVED_ARTICLE_SLUGS = new Set(["new", "edit", "bin"]);

async function ensureUniqueArticleSlug(
  supabase: SupabaseClient,
  categoryId: string,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;

  // Never use reserved slugs (would collide with /new and /edit routes)
  if (RESERVED_ARTICLE_SLUGS.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  while (true) {
    const query = supabase
      .from("resource_articles")
      .select("id")
      .eq("category_id", categoryId)
      .eq("slug", slug)
      .is("deleted_at", null);
    if (excludeId) query.neq("id", excludeId);
    const { data } = await query.limit(1);
    if (!data || data.length === 0) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
}

function revalidate() {
  revalidatePath("/resources", "layout");
}

// ─── Read helpers (*WithClient) ──────────────────────────────────────────────

export async function fetchCategoriesWithClient(
  supabase: SupabaseClient
): Promise<CategoryWithChildren[]> {
  // Fetch non-deleted categories with non-deleted article count
  const { data, error } = await supabase
    .from("resource_categories")
    .select(`${CATEGORY_SELECT}, resource_articles(count)`)
    .is("deleted_at", null)
    .filter("resource_articles.deleted_at", "is", null)
    .order("sort_order")
    .order("name");

  if (error || !data) return [];

  const flat = data.map((cat: Record<string, unknown>) => {
    const articles = cat.resource_articles as
      | [{ count: number }]
      | undefined;
    const articleCount = articles?.[0]?.count ?? 0;
    const { resource_articles: _, ...category } = cat;
    return { ...category, article_count: articleCount } as CategoryWithCount;
  });

  // Build nested structure: top-level parents with children array
  const childMap = new Map<string, CategoryWithCount[]>();
  const topLevel: CategoryWithChildren[] = [];

  for (const cat of flat) {
    if (cat.parent_id) {
      const siblings = childMap.get(cat.parent_id) ?? [];
      siblings.push(cat);
      childMap.set(cat.parent_id, siblings);
    }
  }

  for (const cat of flat) {
    if (!cat.parent_id) {
      topLevel.push({ ...cat, children: childMap.get(cat.id) ?? [] });
    }
  }

  return topLevel;
}

export async function fetchCategoryBySlugWithClient(
  supabase: SupabaseClient,
  categorySlug: string
): Promise<ResourceCategory | null> {
  const { data, error } = await supabase
    .from("resource_categories")
    .select(CATEGORY_SELECT)
    .eq("slug", categorySlug)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;
  return data as ResourceCategory;
}

export async function fetchParentCategory(
  supabase: SupabaseClient,
  parentId: string
): Promise<{ name: string; slug: string } | undefined> {
  const { data } = await supabase
    .from("resource_categories")
    .select("name, slug")
    .eq("id", parentId)
    .single();

  return data ?? undefined;
}

export async function fetchCategoryArticlesWithClient(
  supabase: SupabaseClient,
  categorySlug: string,
  isHRAdmin: boolean
): Promise<{
  category: ResourceCategory | null;
  articles: ArticleWithAuthor[];
}> {
  // Fetch category by slug (non-deleted only)
  const { data: category, error: catError } = await supabase
    .from("resource_categories")
    .select(CATEGORY_SELECT)
    .eq("slug", categorySlug)
    .is("deleted_at", null)
    .single();

  if (catError || !category) {
    return { category: null, articles: [] };
  }

  // Fetch non-deleted articles for this category
  let query = supabase
    .from("resource_articles")
    .select(`${ARTICLE_SELECT}, author:profiles!author_id(${AUTHOR_SELECT})`)
    .eq("category_id", category.id)
    .is("deleted_at", null)
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

export async function fetchSubcategoriesWithClient(
  supabase: SupabaseClient,
  parentId: string
): Promise<CategoryWithCount[]> {
  const { data, error } = await supabase
    .from("resource_categories")
    .select(`${CATEGORY_SELECT}, resource_articles(count)`)
    .eq("parent_id", parentId)
    .is("deleted_at", null)
    .filter("resource_articles.deleted_at", "is", null)
    .order("sort_order")
    .order("name");

  if (error || !data) return [];

  return data.map((cat: Record<string, unknown>) => {
    const articles = cat.resource_articles as [{ count: number }] | undefined;
    const articleCount = articles?.[0]?.count ?? 0;
    const { resource_articles: _, ...category } = cat;
    return { ...category, article_count: articleCount } as CategoryWithCount;
  });
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
  // Fetch category by slug (non-deleted only)
  const { data: category, error: catError } = await supabase
    .from("resource_categories")
    .select(CATEGORY_SELECT)
    .eq("slug", categorySlug)
    .is("deleted_at", null)
    .single();

  if (catError || !category) {
    return { category: null, article: null };
  }

  // Fetch single non-deleted article
  let query = supabase
    .from("resource_articles")
    .select(`${ARTICLE_SELECT}, author:profiles!author_id(${AUTHOR_SELECT})`)
    .eq("category_id", category.id)
    .eq("slug", articleSlug)
    .is("deleted_at", null);

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

// ─── Tree + flat article helpers (for resources redesign) ────────────────────

/**
 * Build a 3-level category tree with slug paths for the sidebar tree.
 * Each node includes its full hierarchical slug path (e.g. "policies/employment").
 */
export async function fetchCategoryTreeWithClient(
  supabase: SupabaseClient
): Promise<CategoryTreeNode[]> {
  const { data, error } = await supabase
    .from("resource_categories")
    .select(`${CATEGORY_SELECT}, resource_articles(count)`)
    .is("deleted_at", null)
    .filter("resource_articles.deleted_at", "is", null)
    .order("sort_order")
    .order("name");

  if (error || !data) return [];

  const flat = data.map((cat: Record<string, unknown>) => {
    const articles = cat.resource_articles as [{ count: number }] | undefined;
    const articleCount = articles?.[0]?.count ?? 0;
    const { resource_articles: _, ...category } = cat;
    return { ...category, article_count: articleCount } as CategoryWithCount;
  });

  // Build parent→children map
  const childMap = new Map<string, CategoryWithCount[]>();
  const slugMap = new Map<string, string>(); // id → slug

  for (const cat of flat) {
    slugMap.set(cat.id, cat.slug);
    if (cat.parent_id) {
      const siblings = childMap.get(cat.parent_id) ?? [];
      siblings.push(cat);
      childMap.set(cat.parent_id, siblings);
    }
  }

  // Recursive tree builder
  function buildNode(
    cat: CategoryWithCount,
    parentSlugPath: string
  ): CategoryTreeNode {
    const slugPath = parentSlugPath
      ? `${parentSlugPath}/${cat.slug}`
      : cat.slug;
    const children = (childMap.get(cat.id) ?? []).map((child) =>
      buildNode(child, slugPath)
    );
    return { ...cat, children, slugPath };
  }

  return flat
    .filter((cat) => !cat.parent_id)
    .map((cat) => buildNode(cat, ""));
}

/**
 * Fetch a single article by slug only (no category slug needed).
 * Used by the flat article route /resources/article/[slug].
 */
export async function fetchArticleBySlugOnly(
  supabase: SupabaseClient,
  articleSlug: string,
  canEdit: boolean
): Promise<{
  article: ArticleWithAuthor | null;
  category: ResourceCategory | null;
  parentCategory: { name: string; slug: string } | null;
}> {
  let query = supabase
    .from("resource_articles")
    .select(
      `${ARTICLE_SELECT}, author:profiles!author_id(${AUTHOR_SELECT}), category:resource_categories!category_id(${CATEGORY_SELECT})`
    )
    .eq("slug", articleSlug)
    .is("deleted_at", null);

  if (!canEdit) {
    query = query.eq("status", "published");
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return { article: null, category: null, parentCategory: null };
  }

  const { category: categoryData, ...articleData } = data as Record<
    string,
    unknown
  >;
  const category = categoryData as ResourceCategory | null;

  // Fetch parent category for breadcrumbs
  let parentCategory: { name: string; slug: string } | null = null;
  if (category?.parent_id) {
    const parent = await fetchParentCategory(supabase, category.parent_id);
    parentCategory = parent ? { name: parent.name, slug: parent.slug } : null;
  }

  return {
    article: articleData as unknown as ArticleWithAuthor,
    category,
    parentCategory,
  };
}

/**
 * Fetch recently updated published articles for the landing page.
 */
export async function fetchRecentlyUpdatedArticles(
  supabase: SupabaseClient,
  limit = 5
): Promise<
  Array<{
    id: string;
    title: string;
    slug: string;
    updated_at: string;
    category_name: string;
    category_slug: string;
  }>
> {
  const { data, error } = await supabase
    .from("resource_articles")
    .select(
      "id, title, slug, updated_at, category:resource_categories!category_id(name, slug)"
    )
    .is("deleted_at", null)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => {
    const cat = row.category as { name: string; slug: string } | null;
    return {
      id: row.id as string,
      title: row.title as string,
      slug: row.slug as string,
      updated_at: row.updated_at as string,
      category_name: cat?.name ?? "",
      category_slug: cat?.slug ?? "",
    };
  });
}

/**
 * Resolve a slug path array (e.g. ["policies", "employment"]) to a category.
 * Walks the tree from root, scoping each segment to its parent.
 * Returns the target category and ancestor chain for breadcrumbs.
 * If resolution fails and slug has 2 segments, checks for old-format article URL.
 */
export async function fetchCategoryBySlugPath(
  supabase: SupabaseClient,
  slugs: string[]
): Promise<{
  category: ResourceCategory | null;
  ancestors: Array<{ name: string; slug: string; slugPath: string }>;
  articleRedirectSlug?: string;
}> {
  const ancestors: Array<{ name: string; slug: string; slugPath: string }> = [];
  let parentId: string | null = null;
  let category: ResourceCategory | null = null;
  let slugPath = "";

  for (let i = 0; i < slugs.length; i++) {
    const currentSlug = slugs[i];
    slugPath = slugPath ? `${slugPath}/${currentSlug}` : currentSlug;

    const query = supabase
      .from("resource_categories")
      .select(CATEGORY_SELECT)
      .eq("slug", currentSlug)
      .is("deleted_at", null);

    if (parentId) {
      query.eq("parent_id", parentId);
    } else {
      query.is("parent_id", null);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      // If the final segment failed and we have exactly 2 segments,
      // check if it's an old article URL (category/article pattern)
      if (slugs.length === 2 && i === 1 && category) {
        const { data: article } = await supabase
          .from("resource_articles")
          .select("slug")
          .eq("category_id", category.id)
          .eq("slug", currentSlug)
          .is("deleted_at", null)
          .single();

        if (article) {
          return {
            category: null,
            ancestors,
            articleRedirectSlug: article.slug,
          };
        }
      }

      return { category: null, ancestors };
    }

    // If not the last segment, add to ancestors
    if (i < slugs.length - 1) {
      ancestors.push({
        name: data.name as string,
        slug: data.slug as string,
        slugPath,
      });
    }

    parentId = data.id as string;
    category = data as ResourceCategory;
  }

  return { category, ancestors };
}

// ─── Category mutations ──────────────────────────────────────────────────────

export async function createCategory(data: {
  name: string;
  description?: string;
  icon?: string;
  icon_colour?: string | null;
  parent_id?: string | null;
  visibility?: "all" | "internal";
}): Promise<{ success: boolean; error?: string; category?: ResourceCategory }> {
  const { supabase } = await requireContentEditor();

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
      icon_colour: data.icon_colour || null,
      sort_order: sortOrder,
      parent_id: data.parent_id || null,
      visibility: data.visibility ?? "internal",
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
    icon_colour?: string | null;
    sort_order?: number;
    visibility?: "all" | "internal";
  }
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireContentEditor();

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
  if (data.icon_colour !== undefined) {
    update.icon_colour = data.icon_colour || null;
  }
  if (data.sort_order !== undefined) {
    update.sort_order = data.sort_order;
  }
  if (data.visibility !== undefined) {
    update.visibility = data.visibility;
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
  const { supabase, user } = await requireContentEditor();

  // Block deletion if category has non-deleted subcategories
  const { count: childCount } = await supabase
    .from("resource_categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id)
    .is("deleted_at", null);

  if (childCount && childCount > 0) {
    return {
      success: false,
      error: `Cannot delete category — it has ${childCount} subcategor${childCount === 1 ? "y" : "ies"}. Delete them first.`,
    };
  }

  // Block deletion if category still has non-deleted articles
  const { count } = await supabase
    .from("resource_articles")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id)
    .is("deleted_at", null);

  if (count && count > 0) {
    return {
      success: false,
      error: `Cannot delete category — it still has ${count} article${count === 1 ? "" : "s"}. Move or delete them first.`,
    };
  }

  // Soft-delete
  const { error } = await supabase
    .from("resource_categories")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .is("deleted_at", null)
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
    .eq("category_id", id)
    .is("deleted_at", null);

  return count ?? 0;
}

// ─── Article mutations ───────────────────────────────────────────────────────

export async function createArticle(
  categoryId: string,
  data: {
    title: string;
    content_json?: TiptapDocument;
    status?: "draft" | "published";
    visibility?: "all" | "internal" | null;
  }
): Promise<{
  success: boolean;
  error?: string;
  article?: ResourceArticle;
}> {
  const { supabase, user } = await requireContentEditor();

  const title = data.title?.trim();
  if (!title) {
    return { success: false, error: "Article title is required" };
  }

  const baseSlug = slugify(title);
  if (!baseSlug) {
    return { success: false, error: "Invalid article title" };
  }

  // Block creating articles directly on a parent that has subcategories
  const { count: childCatCount } = await supabase
    .from("resource_categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", categoryId)
    .is("deleted_at", null);

  if (childCatCount && childCatCount > 0) {
    return {
      success: false,
      error: "Cannot create articles directly in a category that has subcategories. Add the article to a subcategory instead.",
    };
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
  if (data.visibility !== undefined) {
    insert.visibility = data.visibility;
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
    visibility?: "all" | "internal" | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireContentEditor();

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

  if (data.visibility !== undefined) {
    update.visibility = data.visibility;
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
  const { supabase, user } = await requireContentEditor();

  // Soft-delete: set deleted_at + deleted_by, unfeatured if featured
  const { error } = await supabase
    .from("resource_articles")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      is_featured: false,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Failed to delete article" };
  }

  revalidate();
  return { success: true };
}

// ─── Bulk article deletion ──────────────────────────────────────────────────

export async function bulkDeleteArticles(
  articleIds: string[]
): Promise<{ success: boolean; error?: string; deletedCount?: number }> {
  const { supabase, user } = await requireContentEditor();

  if (!articleIds.length) {
    return { success: false, error: "No articles selected" };
  }

  const { data, error } = await supabase
    .from("resource_articles")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      is_featured: false,
    })
    .in("id", articleIds)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    return { success: false, error: "Failed to delete articles" };
  }

  revalidate();
  return { success: true, deletedCount: data?.length ?? 0 };
}

// ─── Bin (soft-deleted items) ───────────────────────────────────────────────

export async function fetchTrashedItems(): Promise<{
  articles: (ArticleWithAuthor & { category_name?: string })[];
  categories: ResourceCategory[];
}> {
  const { supabase } = await requireContentEditor();

  // Fetch soft-deleted articles and categories in parallel
  const [articlesResult, categoriesResult] = await Promise.all([
    supabase
      .from("resource_articles")
      .select(
        `${ARTICLE_SELECT}, author:profiles!author_id(${AUTHOR_SELECT}), category:resource_categories!category_id(name)`
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("resource_categories")
      .select(CATEGORY_SELECT)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);

  const { data: articles } = articlesResult;
  const { data: categories } = categoriesResult;

  // Map category name onto articles for display
  const mappedArticles = (articles ?? []).map(
    (a: Record<string, unknown>) => {
      const cat = a.category as { name: string } | null;
      const { category: _, ...rest } = a;
      return { ...rest, category_name: cat?.name ?? "Unknown" };
    }
  ) as (ArticleWithAuthor & { category_name?: string })[];

  return {
    articles: mappedArticles,
    categories: (categories ?? []) as ResourceCategory[],
  };
}

export async function restoreArticle(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireContentEditor();

  // Ensure the parent category is not deleted
  const { data: article } = await supabase
    .from("resource_articles")
    .select("category_id")
    .eq("id", id)
    .single();

  if (!article) {
    return { success: false, error: "Article not found" };
  }

  const { data: category } = await supabase
    .from("resource_categories")
    .select("id, deleted_at")
    .eq("id", article.category_id)
    .single();

  if (category?.deleted_at) {
    return {
      success: false,
      error: "Cannot restore article — its category is also in the bin. Restore the category first.",
    };
  }

  const { error } = await supabase
    .from("resource_articles")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Failed to restore article" };
  }

  revalidate();
  return { success: true };
}

export async function restoreCategory(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireContentEditor();

  const { error } = await supabase
    .from("resource_categories")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Failed to restore category" };
  }

  revalidate();
  return { success: true };
}

export async function permanentlyDeleteArticle(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireContentEditor();

  // Only allow permanent delete of soft-deleted articles
  const { error } = await supabase
    .from("resource_articles")
    .delete()
    .eq("id", id)
    .not("deleted_at", "is", null);

  if (error) {
    return { success: false, error: "Failed to permanently delete article" };
  }

  revalidate();
  return { success: true };
}

export async function permanentlyDeleteCategory(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireContentEditor();

  // Block if category has subcategories (including soft-deleted)
  const { count: childCount } = await supabase
    .from("resource_categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id);

  if (childCount && childCount > 0) {
    return {
      success: false,
      error: "Cannot permanently delete category — it still has subcategories (including binned ones). Permanently delete those first.",
    };
  }

  // Only allow permanent delete of soft-deleted categories with no articles
  const { count } = await supabase
    .from("resource_articles")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (count && count > 0) {
    return {
      success: false,
      error: "Cannot permanently delete category — it still has articles (including binned ones). Permanently delete those first.",
    };
  }

  const { error } = await supabase
    .from("resource_categories")
    .delete()
    .eq("id", id)
    .not("deleted_at", "is", null);

  if (error) {
    return { success: false, error: "Failed to permanently delete category" };
  }

  revalidate();
  return { success: true };
}

// ─── Featured articles ──────────────────────────────────────────────────────

export type FeaturedArticle = ArticleWithAuthor & {
  category_slug: string;
  category_name: string;
  category_icon: string | null;
  category_icon_colour: string | null;
};

export async function fetchFeaturedArticles(
  supabase: SupabaseClient
): Promise<FeaturedArticle[]> {
  const { data } = await supabase
    .from("resource_articles")
    .select(
      `${ARTICLE_SELECT}, author:profiles!author_id(${AUTHOR_SELECT}), category:resource_categories!category_id(slug, name, icon, icon_colour)`
    )
    .eq("is_featured", true)
    .is("deleted_at", null)
    .eq("status", "published")
    .order("featured_sort_order")
    .limit(MAX_FEATURED_ARTICLES);

  if (!data) return [];

  return data.map((a: Record<string, unknown>) => {
    const cat = a.category as { slug: string; name: string; icon: string | null; icon_colour: string | null } | null;
    const { category: _, ...rest } = a;
    return {
      ...rest,
      category_slug: cat?.slug ?? "",
      category_name: cat?.name ?? "",
      category_icon: cat?.icon ?? null,
      category_icon_colour: cat?.icon_colour ?? null,
    };
  }) as FeaturedArticle[];
}

export async function toggleArticleFeatured(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireContentEditor();

  // Get current featured state
  const { data: article } = await supabase
    .from("resource_articles")
    .select("is_featured, status")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!article) {
    return { success: false, error: "Article not found" };
  }

  if (article.status !== "published") {
    return { success: false, error: "Only published articles can be featured" };
  }

  const newFeatured = !article.is_featured;

  // If featuring, check limit and get sort order in parallel
  if (newFeatured) {
    const [countResult, maxRowResult] = await Promise.all([
      supabase
        .from("resource_articles")
        .select("id", { count: "exact", head: true })
        .eq("is_featured", true)
        .is("deleted_at", null),
      supabase
        .from("resource_articles")
        .select("featured_sort_order")
        .eq("is_featured", true)
        .is("deleted_at", null)
        .order("featured_sort_order", { ascending: false })
        .limit(1)
        .single(),
    ]);

    if ((countResult.count ?? 0) >= MAX_FEATURED_ARTICLES) {
      return {
        success: false,
        error: `Maximum of ${MAX_FEATURED_ARTICLES} featured articles allowed. Unfeature one first.`,
      };
    }

    const nextOrder = (maxRowResult.data?.featured_sort_order ?? -1) + 1;

    const { error } = await supabase
      .from("resource_articles")
      .update({ is_featured: true, featured_sort_order: nextOrder })
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      return { success: false, error: "Failed to feature article" };
    }

    // Race condition safety: verify we haven't exceeded the limit
    const { count: postCount } = await supabase
      .from("resource_articles")
      .select("id", { count: "exact", head: true })
      .eq("is_featured", true)
      .is("deleted_at", null);

    if ((postCount ?? 0) > MAX_FEATURED_ARTICLES) {
      // Another admin featured an article simultaneously — roll back
      await supabase
        .from("resource_articles")
        .update({ is_featured: false, featured_sort_order: 0 })
        .eq("id", id);
      return {
        success: false,
        error: `Maximum of ${MAX_FEATURED_ARTICLES} featured articles allowed. Unfeature one first.`,
      };
    }
  } else {
    const { error } = await supabase
      .from("resource_articles")
      .update({ is_featured: false, featured_sort_order: 0 })
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      return { success: false, error: "Failed to unfeature article" };
    }
  }

  revalidate();
  return { success: true };
}

// ─── Move article between categories ─────────────────────────────────────────

export async function moveArticle(
  articleId: string,
  targetCategoryId: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireContentEditor();

  // Get the article
  const { data: article } = await supabase
    .from("resource_articles")
    .select("id, slug, category_id")
    .eq("id", articleId)
    .is("deleted_at", null)
    .single();

  if (!article) {
    return { success: false, error: "Article not found" };
  }

  if (article.category_id === targetCategoryId) {
    return { success: false, error: "Article is already in this category" };
  }

  // Verify target category exists and is not deleted
  const { data: targetCategory } = await supabase
    .from("resource_categories")
    .select("id, name")
    .eq("id", targetCategoryId)
    .is("deleted_at", null)
    .single();

  if (!targetCategory) {
    return { success: false, error: "Target category not found" };
  }

  // Block moving to a parent category that has subcategories
  const { count: childCatCount } = await supabase
    .from("resource_categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", targetCategoryId)
    .is("deleted_at", null);

  if (childCatCount && childCatCount > 0) {
    return {
      success: false,
      error: "Cannot move articles to a category that has subcategories. Choose a subcategory instead.",
    };
  }

  // Ensure slug is unique in the target category
  const slug = await ensureUniqueArticleSlug(supabase, article.slug, targetCategoryId, articleId);

  const { error } = await supabase
    .from("resource_articles")
    .update({ category_id: targetCategoryId, slug })
    .eq("id", articleId)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Failed to move article" };
  }

  revalidate();
  return { success: true };
}

// ─── Reorder categories ──────────────────────────────────────────────────────

export async function reorderCategories(
  orderedIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireContentEditor();

  if (!orderedIds.length) {
    return { success: false, error: "No categories provided" };
  }

  // Batch update sort_order for all categories in parallel
  const results = await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from("resource_categories").update({ sort_order: i }).eq("id", id)
    )
  );

  const failedResult = results.find((r) => r.error);
  if (failedResult) {
    return { success: false, error: "Failed to reorder categories" };
  }

  revalidate();
  return { success: true };
}

// ─── Auto-save (silent background save) ──────────────────────────────────────

export async function autoSaveArticle(
  params:
    | {
        mode: "create";
        categoryId: string;
        title: string;
        content_json: TiptapDocument | null;
      }
    | {
        mode: "update";
        articleId: string;
        title: string;
        content_json: TiptapDocument | null;
      }
): Promise<{ success: boolean; error?: string; articleId?: string }> {
  const { supabase, user } = await requireContentEditor();

  // Common title validation (shared across create + update)
  const title = params.title?.trim();
  if (!title) {
    return { success: false, error: "Title is required" };
  }

  if (params.mode === "create") {
    const baseSlug = slugify(title);
    if (!baseSlug) {
      return { success: false, error: "Invalid title" };
    }

    const slug = await ensureUniqueArticleSlug(
      supabase,
      params.categoryId,
      baseSlug
    );

    const content = params.content_json
      ? extractPlainText(params.content_json)
      : "";

    const insert: Record<string, unknown> = {
      category_id: params.categoryId,
      title,
      slug,
      content,
      author_id: user.id,
      status: "draft",
    };

    if (params.content_json) {
      insert.content_json = params.content_json;
    }

    const { data: article, error } = await supabase
      .from("resource_articles")
      .insert(insert)
      .select("id")
      .single();

    if (error) {
      return { success: false, error: "Failed to save" };
    }

    // No revalidatePath — silent background save
    return { success: true, articleId: article.id };
  }

  // mode: "update"
  const update: Record<string, unknown> = { title };

  if (params.content_json !== null) {
    update.content_json = params.content_json;
    update.content = extractPlainText(params.content_json);
  }

  const { error } = await supabase
    .from("resource_articles")
    .update(update)
    .eq("id", params.articleId)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Failed to save" };
  }

  // No revalidatePath — silent background save, no slug regeneration
  return { success: true, articleId: params.articleId };
}

// ─── Fetch categories for move dialog ────────────────────────────────────────

export type MoveCategoryOption = {
  id: string;
  name: string;
  icon: string | null;
  icon_colour: string | null;
  parent_id: string | null;
};

export async function fetchCategoriesForMove(
  excludeCategoryId?: string
): Promise<MoveCategoryOption[]> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return [];

  // Fetch all non-deleted categories
  const { data } = await supabase
    .from("resource_categories")
    .select("id, name, icon, icon_colour, parent_id")
    .is("deleted_at", null)
    .order("sort_order");

  if (!data) return [];

  const all = data as MoveCategoryOption[];

  // Find which categories are parents (have children)
  const parentIds = new Set(all.filter((c) => c.parent_id).map((c) => c.parent_id!));

  // Only return leaf categories (no children) — articles can't live on parents
  // Also exclude the current category
  return all.filter(
    (c) => !parentIds.has(c.id) && c.id !== excludeCategoryId
  );
}

// ─── Fetch top-level categories for parent picker ─────────────────────────────

export async function fetchTopLevelCategories(
  excludeId?: string
): Promise<{ id: string; name: string }[]> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return [];

  const query = supabase
    .from("resource_categories")
    .select("id, name")
    .is("deleted_at", null)
    .is("parent_id", null)
    .order("sort_order");

  if (excludeId) {
    query.neq("id", excludeId);
  }

  const { data } = await query;
  return (data ?? []) as { id: string; name: string }[];
}
