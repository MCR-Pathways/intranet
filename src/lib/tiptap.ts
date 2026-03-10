/**
 * Shared Tiptap utilities.
 *
 * - extractPlainText(): recursively extracts plain text from Tiptap JSON
 * - extractMentionIds(): extracts unique mentioned user IDs from Tiptap JSON
 * - isEmptyDocument(): checks if a Tiptap JSON doc has no content
 * - extractHeadings(): extracts H2/H3 headings with slugified IDs
 * - slugifyHeading(): converts heading text to URL-safe IDs
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface TiptapNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: TiptapNode[];
}

export interface TiptapDocument {
  type: "doc";
  content?: TiptapNode[];
}

// ─── Plain text extraction ──────────────────────────────────────────────

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "listItem",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
  "codeBlock",
  "callout",
  "image",
]);

/**
 * Recursively extracts plain text from a Tiptap JSON document.
 * Inserts newlines between block-level nodes.
 * Represents mentions as `@Label`.
 */
export function extractPlainText(doc: TiptapDocument | TiptapNode): string {
  if (doc.type === "text") return doc.text ?? "";
  if (doc.type === "mention") {
    return `@${(doc.attrs?.label as string) ?? (doc.attrs?.id as string) ?? ""}`;
  }
  if (!doc.content) return "";

  return doc.content
    .map((node, i) => {
      const text = extractPlainText(node);
      // Add newlines between block-level nodes (skip first)
      return i > 0 && BLOCK_TYPES.has(node.type) ? `\n${text}` : text;
    })
    .join("");
}

// ─── Mention extraction ─────────────────────────────────────────────────

/**
 * Recursively extracts all unique mentioned user IDs from a Tiptap JSON document.
 */
export function extractMentionIds(doc: TiptapDocument | TiptapNode): string[] {
  const ids = new Set<string>();

  function walk(node: TiptapDocument | TiptapNode) {
    if (node.type === "mention" && typeof node.attrs?.id === "string") {
      ids.add(node.attrs.id);
    }
    if (node.content) {
      node.content.forEach(walk);
    }
  }

  walk(doc);
  return Array.from(ids);
}

// ─── Document helpers ───────────────────────────────────────────────────

/**
 * Checks whether a Tiptap JSON document is empty (no text content).
 * An empty doc is `{ type: "doc", content: [{ type: "paragraph" }] }`.
 */
export function isEmptyDocument(doc: TiptapDocument | null | undefined): boolean {
  if (!doc || !doc.content) return true;
  return extractPlainText(doc).trim().length === 0;
}

// ─── Heading extraction (for article outline / ToC) ─────────────────────

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Converts heading text to a URL-safe slug for use as an element ID.
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Extracts H2/H3 headings from a Tiptap JSON document.
 * Returns headings with deduplicated slugified IDs (appends -2, -3, etc.).
 * Used by both the article renderer (to set id attributes) and the
 * article outline sidebar (to generate anchor links).
 */
export function extractHeadings(
  doc: TiptapDocument | Record<string, unknown> | null | undefined
): HeadingItem[] {
  if (!doc || !("content" in doc) || !Array.isArray(doc.content)) return [];

  const headings: HeadingItem[] = [];
  const slugCounts = new Map<string, number>();

  for (const node of doc.content as TiptapNode[]) {
    if (node.type !== "heading") continue;
    const level = (node.attrs?.level as number) ?? 2;
    if (level !== 2 && level !== 3) continue;

    // Extract text from heading children
    const text = node.content
      ?.map((child) => child.text ?? "")
      .join("")
      .trim();
    if (!text) continue;

    const baseSlug = slugifyHeading(text);
    if (!baseSlug) continue;

    // Deduplicate slugs
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);
    const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;

    headings.push({ id, text, level });
  }

  return headings;
}
