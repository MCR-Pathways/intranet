"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireContentEditor } from "@/lib/auth";
import { extractPlainText } from "@/lib/tiptap";
import { removeArticleFromIndex } from "@/lib/algolia";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TiptapDocument } from "@/lib/tiptap";
import type {
  ArticleWithAuthor,
  CategoryWithCount,
  CategoryWithChildren,
  CategoryTreeNode,
  ResourceCategory,
} from "@/types/database.types";

// ─── SELECT constants ────────────────────────────────────────────────────────

const CATEGORY_SELECT =
  "id, name, slug, description, icon, icon_colour, sort_order, parent_id, visibility, created_at, updated_at, deleted_at, deleted_by";

const ARTICLE_SELECT =
  "id, category_id, title, slug, content, content_json, content_type, google_doc_id, google_doc_url, synced_html, last_synced_at, component_name, status, author_id, created_at, updated_at, published_at, deleted_at, deleted_by, is_featured, featured_sort_order, visibility";

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
  canViewDrafts: boolean
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

  if (!canViewDrafts) {
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

/**
 * Fetch sibling articles in the same category (for "More in [folder]" on article pages).
 */
export async function fetchSiblingArticles(
  supabase: SupabaseClient,
  categoryId: string
): Promise<Array<{ id: string; title: string; slug: string }>> {
  const { data, error } = await supabase
    .from("resource_articles")
    .select("id, title, slug")
    .eq("category_id", categoryId)
    .is("deleted_at", null)
    .eq("status", "published")
    .order("title");

  if (error || !data) return [];
  return data as Array<{ id: string; title: string; slug: string }>;
}

/**
 * Fetch subcategories with their articles for the grouped index view.
 * Returns subcategories that have articles (empty ones hidden), each with
 * their articles array. Used on category pages to show grouped content.
 */
export async function fetchGroupedSubcategoryArticles(
  supabase: SupabaseClient,
  parentId: string,
  canViewDrafts: boolean
): Promise<
  Array<{
    subcategory: CategoryWithCount;
    articles: ArticleWithAuthor[];
  }>
> {
  // Fetch subcategories
  const subcats = await fetchSubcategoriesWithClient(supabase, parentId);

  if (subcats.length === 0) return [];

  // Single query for all articles across all subcategories (avoids N+1).
  // Expanded SELECT so GroupedIndex can reuse ArticleListItem with full
  // kebab (Edit / Move / Publish-or-Unpublish / Unlink / Delete) — needs
  // status, content_type, google_doc_url, category_id, author join, etc.
  const subcatIds = subcats.map((s) => s.id);
  let articlesQuery = supabase
    .from("resource_articles")
    .select(`${ARTICLE_SELECT}, author:profiles!author_id(${AUTHOR_SELECT})`)
    .in("category_id", subcatIds)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (!canViewDrafts) {
    articlesQuery = articlesQuery.eq("status", "published");
  }

  const { data: allArticles } = await articlesQuery;

  // Group articles by subcategory
  const articlesBySubcat = new Map<string, ArticleWithAuthor[]>();
  for (const article of (allArticles ?? []) as unknown as ArticleWithAuthor[]) {
    const list = articlesBySubcat.get(article.category_id) ?? [];
    list.push(article);
    articlesBySubcat.set(article.category_id, list);
  }

  const groups = subcats.map((sub) => ({
    subcategory: sub,
    articles: articlesBySubcat.get(sub.id) ?? [],
  }));

  // Hide subcategories with no articles (unless editor can see drafts)
  return canViewDrafts ? groups : groups.filter((g) => g.articles.length > 0);
}

// ─── Tree + flat article helpers (for resources redesign) ────────────────────

/**
 * Build a 3-level category tree with slug paths for the sidebar tree.
 * Each node includes its full hierarchical slug path (e.g. "policies/employment").
 *
 * `canViewDrafts` gates whether the nested article count includes drafts.
 * RLS would otherwise leak draft counts to HR admins (who have SELECT on
 * drafts but per WS1 policy shouldn't see them). Content editors pass true
 * and see inclusive counts.
 */
export async function fetchCategoryTreeWithClient(
  supabase: SupabaseClient,
  canViewDrafts: boolean
): Promise<CategoryTreeNode[]> {
  let query = supabase
    .from("resource_categories")
    .select(`${CATEGORY_SELECT}, resource_articles(count)`)
    .is("deleted_at", null)
    .filter("resource_articles.deleted_at", "is", null);

  if (!canViewDrafts) {
    query = query.filter("resource_articles.status", "eq", "published");
  }

  const { data, error } = await query
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
  canViewDrafts: boolean
): Promise<{
  article: ArticleWithAuthor | null;
  category: ResourceCategory | null;
  parentCategory: { name: string; slug: string } | null;
}> {
  let query = supabase
    .from("resource_articles")
    .select(
      `${ARTICLE_SELECT}, author:profiles!author_id(${AUTHOR_SELECT}), category:resource_categories!category_id(${CATEGORY_SELECT}, parent:parent_id(name, slug))`
    )
    .eq("slug", articleSlug)
    .is("deleted_at", null);

  if (!canViewDrafts) {
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
  const rawCategory = categoryData as (ResourceCategory & {
    parent: { name: string; slug: string } | { name: string; slug: string }[] | null;
  }) | null;

  // Extract parent from nested join (Supabase may return array for joins)
  const rawParent = rawCategory?.parent;
  const parentCategory = rawParent
    ? (Array.isArray(rawParent) ? rawParent[0] : rawParent)
    : null;

  // Strip parent from category to match ResourceCategory type
  const category = rawCategory
    ? (({ parent: _, ...rest }) => rest)(rawCategory) as ResourceCategory
    : null;

  return {
    article: articleData as unknown as ArticleWithAuthor,
    category,
    parentCategory,
  };
}

/**
 * Fetch recently updated published articles for the landing page.
 * Uses a nested join to resolve parent category names in a single query.
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
    parent_category_name: string | null;
  }>
> {
  const { data, error } = await supabase
    .from("resource_articles")
    .select(
      "id, title, slug, updated_at, category:resource_categories!category_id(name, slug, parent:parent_id(name))"
    )
    .is("deleted_at", null)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => {
    // Supabase joined tables may return arrays — unwrap to single object
    const rawCat = row.category;
    const cat = (Array.isArray(rawCat) ? rawCat[0] : rawCat) as {
      name: string;
      slug: string;
      parent: { name: string } | { name: string }[] | null;
    } | null;

    // Parent is also a join — unwrap if array
    const rawParent = cat?.parent;
    const parent = rawParent
      ? (Array.isArray(rawParent) ? rawParent[0] : rawParent)
      : null;

    return {
      id: row.id as string,
      title: row.title as string,
      slug: row.slug as string,
      updated_at: row.updated_at as string,
      category_name: cat?.name ?? "",
      category_slug: cat?.slug ?? "",
      parent_category_name: parent?.name ?? null,
    };
  });
}

/**
 * Count draft articles across all categories. Gate the call on canEdit —
 * readers always get 0 via RLS anyway, but skip the round-trip. Used by
 * the header Drafts pill.
 */
export async function fetchDraftCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("resource_articles")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "draft");

  if (error) {
    logger.error("fetchDraftCount failed", { error: error.message });
    return 0;
  }
  return count ?? 0;
}

/**
 * Fetch all draft articles across all categories. Gated by caller — only
 * content editors should call this. Returns up to 100 drafts sorted by most
 * recently edited.
 */
export async function fetchDraftArticles(
  supabase: SupabaseClient
): Promise<
  Array<{
    id: string;
    title: string;
    slug: string;
    content_type: string;
    updated_at: string;
    category_name: string;
    parent_category_name: string | null;
    author_name: string | null;
  }>
> {
  const { data, error } = await supabase
    .from("resource_articles")
    .select(
      "id, title, slug, content_type, updated_at, author:profiles!author_id(full_name, preferred_name), category:resource_categories!category_id(name, parent:parent_id(name))"
    )
    .is("deleted_at", null)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    logger.error("fetchDraftArticles failed", { error: error.message });
    return [];
  }
  if (!data) return [];

  return data.map((row: Record<string, unknown>) => {
    const rawCat = row.category;
    const cat = (Array.isArray(rawCat) ? rawCat[0] : rawCat) as {
      name: string;
      parent: { name: string } | { name: string }[] | null;
    } | null;
    const rawParent = cat?.parent;
    const parent = rawParent
      ? (Array.isArray(rawParent) ? rawParent[0] : rawParent)
      : null;

    const rawAuthor = row.author;
    const author = (Array.isArray(rawAuthor) ? rawAuthor[0] : rawAuthor) as {
      full_name: string | null;
      preferred_name: string | null;
    } | null;

    return {
      id: row.id as string,
      title: row.title as string,
      slug: row.slug as string,
      content_type: row.content_type as string,
      updated_at: row.updated_at as string,
      category_name: cat?.name ?? "",
      parent_category_name: parent?.name ?? null,
      author_name: author?.preferred_name || author?.full_name || null,
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

// ─── Article mutations ───────────────────────────────────────────────────────

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
    } else if (data.status === "draft") {
      // Unpublish must also unfeature — otherwise the article stays in
      // is_featured=true, gets hidden by the landing-page published filter,
      // but still counts against MAX_FEATURED_ARTICLES.
      update.is_featured = false;
      update.featured_sort_order = 0;
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
    if (error.code === "23505") {
      return {
        success: false,
        error:
          "A resource with this slug already exists — try a different title.",
      };
    }
    return { success: false, error: "Failed to update article" };
  }

  revalidate();
  return { success: true };
}

export async function deleteArticle(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await requireContentEditor();

  // Fetch status before soft-delete (needed for Algolia cleanup)
  const { data: article, error: fetchError } = await supabase
    .from("resource_articles")
    .select("id, status")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (fetchError || !article) {
    return {
      success: false,
      error: fetchError && fetchError.code !== "PGRST116"
        ? "Failed to delete article"
        : "Article not found",
    };
  }

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

  // Remove from Algolia if the article was published (non-blocking —
  // removeArticleFromIndex handles errors internally)
  if (article.status === "published") {
    await removeArticleFromIndex(id);
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

/** Fetch ALL featured articles (no limit) for settings management. */
export async function fetchFeaturedArticlesAll(): Promise<
  Array<{
    id: string;
    title: string;
    slug: string;
    featured_sort_order: number;
    category_name: string;
  }>
> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return [];

  const { data } = await supabase
    .from("resource_articles")
    .select(
      "id, title, slug, featured_sort_order, category:resource_categories!category_id(name)"
    )
    .eq("is_featured", true)
    .is("deleted_at", null)
    .order("featured_sort_order");

  if (!data) return [];

  return data.map((a: Record<string, unknown>) => {
    const cat = a.category as { name: string } | null;
    return {
      id: a.id as string,
      title: a.title as string,
      slug: a.slug as string,
      featured_sort_order: a.featured_sort_order as number,
      category_name: cat?.name ?? "",
    };
  });
}

/** Reorder a featured article up or down by swapping sort orders. */
export async function reorderFeaturedArticle(
  articleId: string,
  direction: "up" | "down"
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireContentEditor();

  // Get all featured articles ordered
  const { data: featured } = await supabase
    .from("resource_articles")
    .select("id, featured_sort_order")
    .eq("is_featured", true)
    .is("deleted_at", null)
    .order("featured_sort_order");

  if (!featured) return { success: false, error: "Failed to load featured articles" };

  const index = featured.findIndex((f) => f.id === articleId);
  if (index === -1) return { success: false, error: "Article not found" };

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= featured.length) {
    return { success: false, error: "Cannot move further" };
  }

  // Swap sort orders — sequential to avoid partial failure
  const current = featured[index];
  const swap = featured[swapIndex];

  const { error: err1 } = await supabase
    .from("resource_articles")
    .update({ featured_sort_order: swap.featured_sort_order })
    .eq("id", current.id);

  if (err1) return { success: false, error: "Failed to update sort order" };

  const { error: err2 } = await supabase
    .from("resource_articles")
    .update({ featured_sort_order: current.featured_sort_order })
    .eq("id", swap.id);

  if (err2) {
    // Attempt rollback of first update
    await supabase
      .from("resource_articles")
      .update({ featured_sort_order: current.featured_sort_order })
      .eq("id", current.id);
    return { success: false, error: "Failed to update sort order" };
  }

  revalidate();
  return { success: true };
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

/** Swap a category's sort_order with its neighbour (up or down). */
export async function swapCategoryOrder(
  categoryId: string,
  direction: "up" | "down"
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireContentEditor();

  // Get the category to find its parent_id and sort_order
  const { data: cat } = await supabase
    .from("resource_categories")
    .select("id, sort_order, parent_id")
    .eq("id", categoryId)
    .is("deleted_at", null)
    .single();

  if (!cat) return { success: false, error: "Category not found" };

  // Get siblings (same parent)
  const query = supabase
    .from("resource_categories")
    .select("id, sort_order")
    .is("deleted_at", null)
    .order("sort_order");

  if (cat.parent_id) {
    query.eq("parent_id", cat.parent_id);
  } else {
    query.is("parent_id", null);
  }

  const { data: siblings } = await query;
  if (!siblings) return { success: false, error: "Failed to load categories" };

  const index = siblings.findIndex((s) => s.id === categoryId);
  if (index === -1) return { success: false, error: "Category not found in siblings" };

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= siblings.length) {
    return { success: false, error: "Cannot move further" };
  }

  const current = siblings[index];
  const swap = siblings[swapIndex];

  // Sequential with rollback to avoid partial failure
  const { error: err1 } = await supabase
    .from("resource_categories")
    .update({ sort_order: swap.sort_order })
    .eq("id", current.id);

  if (err1) return { success: false, error: "Failed to update sort order" };

  const { error: err2 } = await supabase
    .from("resource_categories")
    .update({ sort_order: current.sort_order })
    .eq("id", swap.id);

  if (err2) {
    // Attempt rollback of first update
    await supabase
      .from("resource_categories")
      .update({ sort_order: current.sort_order })
      .eq("id", current.id);
    return { success: false, error: "Failed to update sort order" };
  }

  revalidate();
  return { success: true };
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
  const { data, error } = await supabase
    .from("resource_categories")
    .select("id, name, icon, icon_colour, parent_id")
    .is("deleted_at", null)
    .order("sort_order");

  if (error) {
    logger.error("fetchCategoriesForMove: Supabase error", { error: error.message, code: error.code });
    return [];
  }

  if (!data) return [];

  const all = data as MoveCategoryOption[];

  // Return all categories (articles can live at any level)
  // Exclude the optionally specified category (e.g. current category when moving)
  return all.filter((c) => c.id !== excludeCategoryId);
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

/** Server action wrapper for fetchCategoriesWithClient — callable from client components. */
export async function fetchAllCategoriesAction(): Promise<CategoryWithChildren[]> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return [];
  return fetchCategoriesWithClient(supabase);
}

// ─── Search ─────────────────────────────────────────────────────────────────
// Full-text search is handled client-side via Algolia React InstantSearch.
// See src/components/resources/resource-search.tsx and src/lib/algolia.ts.
// Indexing happens server-side in drive-actions.ts (link/sync/unlink).
