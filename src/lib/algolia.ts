/**
 * Algolia client utilities for search indexing and querying.
 *
 * Two clients:
 * - Search client (public key) — used client-side for React InstantSearch
 * - Admin client (admin key) — used server-side for indexing (push records)
 *
 * Indices:
 * - `resources_articles` — one record per section (heading + content)
 * - `learning_courses` — one record per published course
 * - `news_posts` — one record per news post (excludes kudos + round-ups)
 */

import { algoliasearch } from "algoliasearch";
import { logger } from "@/lib/logger";

// ─── Config ──────────────────────────────────────────────────────────────────

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID ?? "";
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY ?? "";
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY ?? "";

export const RESOURCES_INDEX = "resources_articles";
export const COURSES_INDEX = "learning_courses";
export const NEWS_INDEX = "news_posts";

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
 * Truncate a section's plaintext content to fit Algolia's per-record size
 * limit (10KB on standard tier). Truncates on the last word boundary
 * before the cap with a " …" suffix so search-result snippets can signal
 * to the reader that the section continues on the page itself.
 *
 * The non-content fields on AlgoliaResourceRecord (title, hierarchy,
 * slugs, timestamps, etc.) take ~500 bytes including JSON overhead; the
 * 8000-byte content cap leaves ~1.5KB of headroom for the other fields
 * + JSON encoding overhead.
 */
const ALGOLIA_MAX_CONTENT_BYTES = 8000;

function truncateForAlgolia(content: string): string {
  // Length comparison is on UTF-8 byte length, not character count —
  // Algolia's limit is bytes, and many WP articles contain em-dashes,
  // smart quotes, and other multi-byte characters that would slip past
  // a `.length` check while still tripping the API limit.
  const byteLength = Buffer.byteLength(content, "utf8");
  if (byteLength <= ALGOLIA_MAX_CONTENT_BYTES) return content;

  // Walk backwards from the byte cap until we find a UTF-8 boundary +
  // a word break. Cap at characters to start; refine if still over.
  let truncated = content.slice(0, ALGOLIA_MAX_CONTENT_BYTES);
  // Cut on the last whitespace to avoid mid-word truncation.
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > ALGOLIA_MAX_CONTENT_BYTES * 0.8) {
    truncated = truncated.slice(0, lastSpace);
  }

  // Re-check byte length after slicing — multi-byte characters mean
  // a 8000-character slice can still exceed 8000 bytes. Keep trimming
  // 200 chars at a time until under the cap.
  while (Buffer.byteLength(truncated + " …", "utf8") > ALGOLIA_MAX_CONTENT_BYTES) {
    truncated = truncated.slice(0, truncated.length - 200);
  }

  return truncated + " …";
}

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

    // Build records — one per section, with content truncation to stay
    // under Algolia's per-record size limit (10KB on standard tier).
    // The other fields (title + slugs + hierarchy + timestamps) take ~500
    // bytes including JSON overhead; capping content at 8KB keeps the
    // total record well under 10KB with headroom for headings up to 1KB.
    // Truncation ends on a word boundary to avoid mid-word cuts in
    // snippet rendering, with a clear " …" suffix so search UIs can
    // signal that the section content is truncated.
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
        content: truncateForAlgolia(section.content),
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

// ─── Course indexing (server-side) ──────────────────────────────────────────

export interface AlgoliaCourseRecord {
  objectID: string;
  courseId: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  duration: number | null;
  isRequired: boolean | null;
  sectionCount: number;
  updatedAt: string | null;
  /** Discriminator for global search result grouping */
  _type: "course";
}

/**
 * Index a course into Algolia. Called on publish.
 */
export async function indexCourse(
  courseId: string,
  title: string,
  description: string | null,
  category: string,
  categoryLabel: string,
  duration: number | null,
  isRequired: boolean | null,
  sectionCount: number,
  updatedAt: string | null
): Promise<void> {
  try {
    const client = getAdminClient();

    const record: AlgoliaCourseRecord = {
      objectID: courseId,
      courseId,
      title,
      description: description ?? "",
      category,
      categoryLabel,
      duration,
      isRequired,
      sectionCount,
      updatedAt,
      _type: "course",
    };

    await client.saveObjects({
      indexName: COURSES_INDEX,
      objects: [record as unknown as Record<string, unknown>],
    });

    logger.info("Algolia: indexed course", { courseId, title });
  } catch (error) {
    logger.warn("Algolia: failed to index course", {
      courseId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Remove a course from Algolia. Called on unpublish or delete.
 */
export async function removeCourseFromIndex(courseId: string): Promise<void> {
  try {
    const client = getAdminClient();

    await client.deleteObjects({
      indexName: COURSES_INDEX,
      objectIDs: [courseId],
    });

    logger.info("Algolia: removed course from index", { courseId });
  } catch (error) {
    logger.warn("Algolia: failed to remove course from index", {
      courseId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─── News post indexing (server-side) ───────────────────────────────────────

export interface AlgoliaPostRecord {
  objectID: string;
  postId: string;
  /** First line / short lead — posts have no title, so this stands in for one */
  excerpt: string;
  /** Post body (plaintext, truncated to the Algolia per-record size cap) */
  content: string;
  /** Author display name (no IDs or emails) */
  authorName: string;
  /** Created timestamp (ISO) for the "· 3 days ago" line */
  createdAt: string;
  /** Created timestamp (ms) — the customRanking tie-break (newest first) */
  createdAtTimestamp: number;
  /** Discriminator for global search result grouping */
  _type: "news";
}

const POST_EXCERPT_MAX_CHARS = 120;

/** Build a single-line lead from the post body for the result-row title. */
function buildPostExcerpt(content: string): string {
  const firstLine =
    content
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  if (firstLine.length <= POST_EXCERPT_MAX_CHARS) return firstLine;
  const clipped = firstLine.slice(0, POST_EXCERPT_MAX_CHARS);
  const lastSpace = clipped.lastIndexOf(" ");
  const trimmed =
    lastSpace > POST_EXCERPT_MAX_CHARS * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return trimmed + " …";
}

/**
 * Resolve a display name from the Supabase author join, which the typed client
 * gives as object-or-array for a to-one relationship. Falls back to the org
 * name so a record never indexes an empty author.
 */
export function resolveSearchAuthorName(
  join:
    | { full_name: string | null; preferred_name: string | null }
    | Array<{ full_name: string | null; preferred_name: string | null }>
    | null
    | undefined
): string {
  const author = Array.isArray(join) ? join[0] : join;
  return author?.preferred_name?.trim() || author?.full_name?.trim() || "MCR Pathways";
}

export interface PostRecordInput {
  postId: string;
  content: string;
  /** Poll question, when the post is a poll — folded into the searchable body */
  pollQuestion?: string | null;
  authorName: string;
  createdAt: string;
}

/**
 * Build the Algolia record for a news post. Single source of truth shared by
 * the runtime indexer (`indexPost`) and the backfill (`scripts/index-posts.ts`)
 * so the two can't drift. The excerpt is the body's lead (the result-row
 * title); the poll question is appended to the searchable content so polls are
 * findable by their question, not just their body.
 */
export function buildPostRecord(input: PostRecordInput): AlgoliaPostRecord {
  const question = input.pollQuestion?.trim();
  const searchable = question ? `${input.content}\n${question}` : input.content;
  return {
    objectID: input.postId,
    postId: input.postId,
    excerpt: buildPostExcerpt(input.content),
    content: truncateForAlgolia(searchable),
    authorName: input.authorName,
    createdAt: input.createdAt,
    createdAtTimestamp: new Date(input.createdAt).getTime(),
    _type: "news",
  };
}

/**
 * Index a news post into Algolia. Called on create and edit.
 * Mirrors `indexCourse`: build one record and upsert it.
 */
export async function indexPost(input: PostRecordInput): Promise<void> {
  try {
    const client = getAdminClient();
    const record = buildPostRecord(input);

    await client.saveObjects({
      indexName: NEWS_INDEX,
      objects: [record as unknown as Record<string, unknown>],
    });

    logger.info("Algolia: indexed news post", { postId: input.postId });
  } catch (error) {
    logger.warn("Algolia: failed to index news post", {
      postId: input.postId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Remove a news post from Algolia. Called on delete, or when a post no
 * longer qualifies as news.
 */
export async function removePostFromIndex(postId: string): Promise<void> {
  try {
    const client = getAdminClient();

    await client.deleteObjects({
      indexName: NEWS_INDEX,
      objectIDs: [postId],
    });

    logger.info("Algolia: removed news post from index", { postId });
  } catch (error) {
    logger.warn("Algolia: failed to remove news post from index", {
      postId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─── Resource article operations ────────────────────────────────────────────

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
