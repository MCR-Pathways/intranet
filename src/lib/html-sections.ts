/**
 * Parse sanitised HTML into sections for Algolia indexing.
 *
 * Splits content on heading elements (h1-h4), producing an array of
 * { heading, headingSlug, content } objects. The first section may have
 * a null heading (content before the first heading).
 *
 * Used by the sync pipeline to create section-level Algolia records.
 */

import { parseHTML } from "linkedom";
import { slugifyHeading } from "./article-constants";

// Re-export so existing consumers (drive-actions.ts, etc.) keep the same import path
export { slugifyHeading };

export interface HtmlSection {
  /** Heading text (null for intro content before first heading) */
  heading: string | null;
  /** URL-safe slug for deep linking (null if no heading) */
  headingSlug: string | null;
  /** Plaintext content of the section */
  content: string;
}

/**
 * Parse HTML into sections split on headings.
 * Each section contains the heading text, a slug for deep linking,
 * and the plaintext content of that section.
 */
export function parseHtmlIntoSections(html: string): HtmlSection[] {
  if (!html) return [];

  // linkedom requires full HTML structure — wrap fragments if no <body> tag
  const wrapped = html.includes("<body") ? html : `<html><body>${html}</body></html>`;
  const { document } = parseHTML(wrapped);
  const body = document.body;
  if (!body) return [];

  const sections: HtmlSection[] = [];
  let currentHeading: string | null = null;
  let currentSlug: string | null = null;
  let currentContent: string[] = [];

  const headingTags = new Set(["H1", "H2", "H3", "H4"]);

  for (const node of Array.from(body.children)) {
    if (headingTags.has(node.tagName)) {
      // Flush previous section
      const content = currentContent.join(" ").replace(/\s+/g, " ").trim();
      if (content || currentHeading) {
        sections.push({
          heading: currentHeading,
          headingSlug: currentSlug,
          content,
        });
      }

      // Start new section
      const headingText = (node.textContent ?? "").trim();
      currentHeading = headingText || null;
      currentSlug = headingText ? slugifyHeading(headingText) : null;
      currentContent = [];
    } else {
      // Accumulate content
      const text = (node.textContent ?? "").trim();
      if (text) currentContent.push(text);
    }
  }

  // Flush final section
  const content = currentContent.join(" ").replace(/\s+/g, " ").trim();
  if (content || currentHeading) {
    sections.push({
      heading: currentHeading,
      headingSlug: currentSlug,
      content,
    });
  }

  return sections;
}
