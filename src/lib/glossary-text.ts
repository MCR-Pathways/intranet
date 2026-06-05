/**
 * Shared glossary text extraction. The static read view stamps each
 * `.glossary-entry` with `data-glossary-text` (term + definition, normalised)
 * for the on-page filter to match against; the filter derives its result count
 * from the same texts, and the article view derives which TOC sections to hide.
 * All of it goes through here so the pieces can't drift apart.
 */

/** Recursively join a Plate node's text leaves (no separator — leaves within a
 *  single term/definition are contiguous). */
function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: unknown; children?: unknown[] };
  if (typeof n.text === "string") return n.text;
  if (!Array.isArray(n.children)) return "";
  return n.children.map(nodeText).join("");
}

/**
 * Normalise text for filtering: lower-case, and fold curly apostrophes
 * (U+2018/U+2019) to a straight `'` so a query typed with a straight apostrophe
 * still matches a source term like "Children's" that carries a curly one. Both
 * the indexed entry text and the query run through this, so they agree.
 */
export function normalizeFilterText(s: string): string {
  return s.toLowerCase().replace(/[‘’]/g, "'");
}

/**
 * The filter text for one glossary_entry: its children (term, definition)
 * joined with a SPACE so the term isn't glued to the definition's first word,
 * whitespace-collapsed, trimmed, and normalised.
 */
export function glossaryEntryText(entry: unknown): string {
  const children = ((entry as { children?: unknown[] })?.children ?? []) as unknown[];
  return normalizeFilterText(
    children.map(nodeText).join(" ").replace(/\s+/g, " ").trim(),
  );
}

/** Every glossary_entry's filter text, in document order (recursive, so it
 *  catches entries wherever a glossary sits). Matches the rendered
 *  `.glossary-entry` DOM order. */
export function extractGlossaryEntryTexts(value: unknown): string[] {
  const out: string[] = [];
  const walk = (nodes: unknown[]) => {
    for (const node of nodes) {
      const n = node as { type?: string; children?: unknown[] };
      if (n.type === "glossary_entry") {
        out.push(glossaryEntryText(n));
      } else if (Array.isArray(n.children)) {
        walk(n.children);
      }
    }
  };
  if (Array.isArray(value)) walk(value);
  return out;
}

const HEADING_TYPES = new Set(["h1", "h2", "h3", "h4"]);

/**
 * Top-level sections: each heading and the entry texts of any glossary that
 * follows it before the next heading. Used to decide which TOC headings to
 * hide when the filter empties their section. Only top-level glossaries carry a
 * TOC heading, so a top-level walk is the right scope here (the flat entry list
 * above stays recursive for the filter itself).
 */
export function extractGlossarySections(
  value: unknown,
): Array<{ heading: string; entryTexts: string[] }> {
  const sections: Array<{ heading: string; entryTexts: string[] }> = [];
  if (!Array.isArray(value)) return sections;
  let current: { heading: string; entryTexts: string[] } | null = null;
  for (const node of value) {
    const n = node as { type?: string; children?: unknown[] };
    if (n.type && HEADING_TYPES.has(n.type)) {
      current = { heading: nodeText(n).trim(), entryTexts: [] };
      sections.push(current);
    } else if (n.type === "glossary" && current) {
      for (const child of (n.children ?? []) as unknown[]) {
        if ((child as { type?: string }).type === "glossary_entry") {
          current.entryTexts.push(glossaryEntryText(child));
        }
      }
    }
  }
  return sections;
}
