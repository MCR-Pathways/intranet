/**
 * Shared utilities for the Resources module.
 */

/**
 * Extract a plain-text excerpt from synced HTML content.
 * Strips all tags, normalises whitespace, and truncates to `maxLength` characters.
 *
 * Runs client-side (no linkedom dependency) using a simple regex strip
 * since excerpts are display-only and don't need full DOM parsing.
 */
export function getExcerpt(
  html: string | null | undefined,
  maxLength = 120
): string {
  if (!html) return "";

  // Strip HTML tags and decode common entities
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}
