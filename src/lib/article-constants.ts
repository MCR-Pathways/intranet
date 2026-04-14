/**
 * Shared constants and utilities for article rendering.
 *
 * Used by Google Doc, native Plate, and legacy Tiptap article views.
 * Lightweight — no platejs or heavyweight imports. Heading extraction
 * lives in plate-static-plugins.tsx (needs platejs/static).
 */

// ─── Prose classes ──────────────────────────────────────────────────────

/** Content-level prose modifiers (no layout constraints). Used by both
 *  the article wrapper and column items. */
export const ARTICLE_CONTENT_MODIFIERS =
  "prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-foreground/85 prose-p:leading-relaxed prose-li:text-foreground/85 prose-a:text-link prose-a:underline-offset-4 hover:prose-a:text-link/80 prose-img:rounded-lg prose-hr:border-border";

/** Full prose class string for article content areas. */
export const ARTICLE_PROSE_CLASSES =
  `prose prose-sm max-w-[720px] ${ARTICLE_CONTENT_MODIFIERS}`;

/** Card wrapper classes for article detail views. */
export const ARTICLE_CARD_CLASSES =
  "bg-card shadow-md rounded-xl overflow-clip p-6 md:p-7 space-y-5";

// ─── Heading slugs ──────────────────────────────────────────────────────

/**
 * Convert heading text to a URL-safe slug.
 *
 * Single source of truth — replaces the inline copy in
 * google-doc-article-view.tsx and the export in html-sections.ts.
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Create a deduplicating slugify function for a single document pass.
 * Appends -1, -2, etc. to duplicate base slugs.
 *
 * Adopts the Google Doc view convention:
 *   first occurrence → "slug"
 *   second → "slug-1"
 *   third → "slug-2"
 *
 * The legacy Tiptap scheme in tiptap.ts (foo, foo-2, foo-3) is left
 * unchanged — it only serves the legacy ArticleView path.
 */
export function createSlugDeduplicator(): (text: string) => string {
  const counts = new Map<string, number>();
  return (text: string) => {
    const base = slugifyHeading(text);
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count > 0 ? `${base}-${count}` : base;
  };
}

// ─── Types ──────────────────────────────────────────────────────────────

export interface ArticleHeading {
  text: string;
  slug: string;
  level: number;
}
