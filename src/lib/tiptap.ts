/**
 * Shared Tiptap utilities for the news feed.
 *
 * - extractPlainText(): recursively extracts plain text from Tiptap JSON
 * - extractMentionIds(): extracts unique mentioned user IDs from Tiptap JSON
 * - isEmptyDocument(): checks if a Tiptap JSON doc has no content
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
