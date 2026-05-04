/**
 * Centre-column widths for routes that constrain their main content.
 *
 * Single source of truth for two surfaces:
 *   1. Page wrappers use `max-w-[var(--centre-column,100%)]` (Tailwind
 *      arbitrary value reading the CSS custom property).
 *   2. AppLayout reads `getCentreColumnCSS(pathname)` and sets
 *      `--centre-column` on `<main>` so the DailyBanner above the page
 *      content respects the same constraint.
 *
 * Add a route here only when both the page wrapper AND the banner above
 * should share a constrained width. Routes not listed default to the full
 * container width (the variable falls back to 100% via the Tailwind class).
 */
export const CENTRE_COLUMN_WIDTHS = {
  intranet: 590,
} as const;

/**
 * Returns the CSS value for `--centre-column` on a given pathname, or null
 * when the route uses the full container width.
 *
 * Only `/intranet` and post-detail pages under `/intranet/post/` constrain.
 * Other intranet sub-routes (`/intranet/induction`, `/intranet/policies`,
 * `/intranet/guides`, `/intranet/surveys`, `/intranet/weekly-roundup`) and
 * all other top-level routes use the full container.
 */
export function getCentreColumnCSS(pathname: string): string | null {
  if (pathname === "/intranet") return `${CENTRE_COLUMN_WIDTHS.intranet}px`;
  if (pathname.startsWith("/intranet/post/")) return `${CENTRE_COLUMN_WIDTHS.intranet}px`;
  return null;
}
