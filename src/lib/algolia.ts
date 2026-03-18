/**
 * Algolia client utilities for search indexing and querying.
 *
 * Two clients:
 * - Search client (public key) — used client-side for React InstantSearch
 * - Admin client (admin key) — used server-side for indexing (push records)
 *
 * Index: `resources_articles` — one record per section (heading + content).
 * Each article is split into multiple records for section-level search.
 */

import { algoliasearch } from "algoliasearch";
import { logger } from "@/lib/logger";

// ─── Config ──────────────────────────────────────────────────────────────────

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID ?? "";
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY ?? "";
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY ?? "";

export const RESOURCES_INDEX = "resources_articles";

// ─── Clients ─────────────────────────────────────────────────────────────────

/** Public search client — safe for client-side use. */
export function getSearchClient() {
  return algoliasearch(APP_ID, SEARCH_KEY);
}

/** Admin client — server-side only, for indexing operations. */
function getAdminClient() {
  if (!ADMIN_KEY) {
    throw new Error("ALGOLIA_ADMIN_KEY not configured");
  }
  return algoliasearch(APP_ID, ADMIN_KEY);
}

// ─── Algolia record shape ────────────────────────────────────────────────────

export interface AlgoliaResourceRecord {
  /** Unique ID: `{articleId}_{sectionIndex}` */
  objectID: string;
  /** Article UUID (for grouping/deletion) */
  articleId: string;
  /** Article title */
  title: string;
  /** Article slug (for URL construction) */
  slug: string;
  /** Content type: google_doc | component */
  contentType: string;
  /** Category name */
  categoryName: string;
  /** Category slug */
  categorySlug: string;
  /** Hierarchy level 0: category name */
  hierarchy_lvl0: string;
  /** Hierarchy level 1: article title */
  hierarchy_lvl1: string;
  /** Hierarchy level 2: section heading (null for intro/untitled sections) */
  hierarchy_lvl2: string | null;
  /** Section heading text (for display) */
  sectionHeading: string | null;
  /** Section heading slug (for deep links: #section-slug) */
  sectionSlug: string | null;
  /** Section content (plaintext) */
  content: string;
  /** Last updated timestamp */
  updatedAt: string;
}

// ─── Indexing operations (server-side) ───────────────────────────────────────

/**
 * Index article sections into Algolia.
 * Replaces any existing records for this article.
 */
export async function indexArticleSections(
  articleId: string,
  slug: string,
  title: string,
  contentType: string,
  categoryName: string,
  categorySlug: string,
  sections: Array<{
    heading: string | null;
    headingSlug: string | null;
    content: string;
  }>,
  updatedAt: string
): Promise<void> {
  try {
    const client = getAdminClient();

    // First remove existing records for this article
    await removeArticleFromIndex(articleId);

    // Build records — one per section
    const records: AlgoliaResourceRecord[] = sections.map(
      (section, index) => ({
        objectID: `${articleId}_${index}`,
        articleId,
        title,
        slug,
        contentType,
        categoryName,
        categorySlug,
        hierarchy_lvl0: categoryName,
        hierarchy_lvl1: title,
        hierarchy_lvl2: section.heading,
        sectionHeading: section.heading,
        sectionSlug: section.headingSlug,
        content: section.content,
        updatedAt,
      })
    );

    if (records.length === 0) return;

    await client.saveObjects({
      indexName: RESOURCES_INDEX,
      objects: records as unknown as Record<string, unknown>[],
    });

    logger.info("Algolia: indexed article sections", {
      articleId,
      slug,
      sectionCount: records.length,
    });
  } catch (error) {
    // Non-critical — search will be stale but app still works
    logger.warn("Algolia: failed to index article", {
      articleId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Remove all Algolia records for an article (called on unlink).
 */
export async function removeArticleFromIndex(
  articleId: string
): Promise<void> {
  try {
    const client = getAdminClient();

    await client.deleteBy({
      indexName: RESOURCES_INDEX,
      deleteByParams: {
        filters: `articleId:${articleId}`,
      },
    });

    logger.info("Algolia: removed article from index", { articleId });
  } catch (error) {
    logger.warn("Algolia: failed to remove article from index", {
      articleId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
