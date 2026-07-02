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
  "prose-headings:font-semibold prose-headings:tracking-tight prose-headings:scroll-mt-24 prose-p:text-foreground/85 prose-p:leading-relaxed prose-li:text-foreground/85 prose-a:text-link prose-a:underline-offset-4 hover:prose-a:text-link/80 prose-img:rounded-lg prose-hr:border-border";

/** Full prose class string for article content areas.
 *
 * `max-w-[90ch]` is the §4 reading measure (decided 2026-07-02 after live
 * comparison of fill / prose-only-cap / column-cap on real articles): the
 * whole column of text, grids and tables caps together at ~90ch of the
 * prose-sm font, so there's one uniform right edge and no ragged "text stops
 * midway". Wider than prose's 65ch default (which the `ch` value overrides)
 * and the old 720px cap; narrower than the full card, whose leftover becomes
 * a quiet gutter before the borderless rail. On a 1366px Chromebook the
 * column is naturally narrower than the cap, so nothing changes there; only
 * ~1920px externals see the measure. Paired constant: the resource grid's
 * 210px tile minimum (ResourceGrid in plate-static-plugins.tsx) is tuned to
 * give 3-up tiles inside this measure. Retune the two together. */
export const ARTICLE_PROSE_CLASSES =
  `prose prose-sm max-w-[90ch] ${ARTICLE_CONTENT_MODIFIERS}`;

/** Card wrapper classes for article detail views.
 *
 * Soft-retreat shape: deliberately keeps `shadow-sm` even though the canonical
 * card/table wrapper moved to `shadow-md` (ADR-014 P2-D, for separation on the
 * ivory canvas). On this large reading surface `shadow-md` reads as a heavy
 * slab — the same "tall white slab" the earlier `minHeight` removal fixed — so
 * the article card recedes with the lighter shadow. Tightened padding + rhythm
 * so the header doesn't dominate the visible area. The article-constants test
 * guards this divergence. */
export const ARTICLE_CARD_CLASSES =
  "bg-card border border-border shadow-sm rounded-xl overflow-clip p-5 md:p-6 space-y-4";

// ─── Internal link detection ────────────────────────────────────────────

/**
 * Parsed origin of the app URL. Used to detect absolute intranet links
 * (e.g. pasted from the address bar) in both GoogleDocArticleView and
 * LinkStatic. Parsed once at module level since NEXT_PUBLIC_* env vars
 * are inlined at build time. Returns null if unset or malformed.
 */
export const APP_ORIGIN = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "").origin; }
  catch { return null; }
})();

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

/**
 * The headings the reading rail lists and scroll-spies: the top two heading
 * levels present in the document.
 *
 * On well-formed content (bodies start at H2, per the Plate editor and the
 * WP-migration convention) that is exactly H2 + H3. The general rule exists
 * for synced Google Docs and irregular authoring: an H1-sectioned Doc (Docs'
 * default heading style, and the sanitiser does not demote levels) rails
 * H1 + H2, and an article that skips H3 rails H2 + H4. A hardcoded 2|3 filter
 * would silently delete the whole rail for those shapes. Deeper levels keep
 * their anchors (deep links, search, `scroll-mt`); they just aren't listed.
 *
 * Feed this filtered list to `useScrollSpy` (not the full list) and the
 * ancestor-fallback marker comes for free: reading inside an unlisted deeper
 * section, the hook's gap-state branch lands on the last listed heading above
 * the fold, which is its nearest listed ancestor. See `resources/CLAUDE.md`
 * and `use-scroll-spy.ts`.
 */
export function filterRailHeadings(headings: ArticleHeading[]): ArticleHeading[] {
  const levels = [...new Set(headings.map((h) => h.level))].sort((a, b) => a - b);
  const kept = new Set(levels.slice(0, 2));
  return headings.filter((h) => kept.has(h.level));
}

// ─── Article layout ─────────────────────────────────────────────────────

/** Article layout grid (§4): three children in DOM order, header block, then
 *  ArticleOutline, then the content block. Below `lg` they stack in that
 *  order, which puts the "On this page" disclosure between the title and the
 *  content. From `lg` the rail places itself in column 2 spanning both rows
 *  (classes on ArticleOutline's nav), giving header-over-content on the left
 *  with the sticky rail alongside. Shared by the native and Google Doc views
 *  so the two layouts cannot drift. */
export const ARTICLE_LAYOUT_CLASSES =
  "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-8 lg:gap-y-5";

/** The header block (title + actions + meta) inside ARTICLE_LAYOUT_CLASSES. */
export const ARTICLE_HEADER_CLASSES = "min-w-0";

/** The content block inside ARTICLE_LAYOUT_CLASSES. No width cap of its own,
 *  the reading measure lives on ARTICLE_PROSE_CLASSES; siblings of the
 *  article inside this block (controls, empty states) carry `max-w-[90ch]`
 *  themselves so nothing runs past the measure's right edge. */
export const ARTICLE_COLUMN_CLASSES = "min-w-0 space-y-5";
