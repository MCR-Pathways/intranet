import { describe, it, expect } from "vitest";
import {
  extractPlainText,
  extractMentionIds,
  isEmptyDocument,
  type TiptapDocument,
} from "./tiptap";

// ─── extractPlainText ──────────────────────────────────────────────────

describe("extractPlainText", () => {
  it("extracts text from a simple paragraph", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("Hello world");
  });

  it("extracts text from multiple paragraphs with newlines", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Line one" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Line two" }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("Line one\nLine two");
  });

  it("represents mentions as @Label", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hey " },
            {
              type: "mention",
              attrs: { id: "user-123", label: "Jane Smith" },
            },
            { type: "text", text: " check this out" },
          ],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("Hey @Jane Smith check this out");
  });

  it("falls back to mention id when label is missing", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "mention", attrs: { id: "abc-123" } },
          ],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("@abc-123");
  });

  it("handles empty document", () => {
    const doc: TiptapDocument = { type: "doc" };
    expect(extractPlainText(doc)).toBe("");
  });

  it("handles document with empty paragraph", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
    expect(extractPlainText(doc)).toBe("");
  });

  it("extracts text from nested lists", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item one" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item two" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const result = extractPlainText(doc);
    expect(result).toContain("Item one");
    expect(result).toContain("Item two");
  });

  it("handles text with marks (bold, italic)", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            {
              type: "text",
              text: "bold",
              marks: [{ type: "bold" }],
            },
            { type: "text", text: " world" },
          ],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("Hello bold world");
  });
});

// ─── extractMentionIds ─────────────────────────────────────────────────

describe("extractMentionIds", () => {
  it("returns empty array for document with no mentions", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "No mentions here" }],
        },
      ],
    };
    expect(extractMentionIds(doc)).toEqual([]);
  });

  it("extracts mention IDs from a single paragraph", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hey " },
            {
              type: "mention",
              attrs: { id: "user-1", label: "Alice" },
            },
            { type: "text", text: " and " },
            {
              type: "mention",
              attrs: { id: "user-2", label: "Bob" },
            },
          ],
        },
      ],
    };
    expect(extractMentionIds(doc)).toEqual(["user-1", "user-2"]);
  });

  it("deduplicates mentions of the same user", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "mention", attrs: { id: "user-1", label: "Alice" } },
            { type: "text", text: " ... " },
            { type: "mention", attrs: { id: "user-1", label: "Alice" } },
          ],
        },
      ],
    };
    expect(extractMentionIds(doc)).toEqual(["user-1"]);
  });

  it("extracts mentions from nested content", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "mention", attrs: { id: "deep-user", label: "Deep" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(extractMentionIds(doc)).toEqual(["deep-user"]);
  });

  it("handles empty document", () => {
    const doc: TiptapDocument = { type: "doc" };
    expect(extractMentionIds(doc)).toEqual([]);
  });

  it("ignores mentions without string id", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "mention", attrs: { label: "No ID" } },
            { type: "mention", attrs: { id: 123 as unknown as string, label: "Numeric" } },
          ],
        },
      ],
    };
    expect(extractMentionIds(doc)).toEqual([]);
  });
});

// ─── isEmptyDocument ───────────────────────────────────────────────────

describe("isEmptyDocument", () => {
  it("returns true for null", () => {
    expect(isEmptyDocument(null)).toBe(true);
  });

  it("returns true for undefined", () => {
    expect(isEmptyDocument(undefined)).toBe(true);
  });

  it("returns true for doc with no content", () => {
    expect(isEmptyDocument({ type: "doc" })).toBe(true);
  });

  it("returns true for doc with empty paragraph", () => {
    expect(
      isEmptyDocument({
        type: "doc",
        content: [{ type: "paragraph" }],
      })
    ).toBe(true);
  });

  it("returns true for doc with whitespace-only text", () => {
    expect(
      isEmptyDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "   " }],
          },
        ],
      })
    ).toBe(true);
  });

  it("returns false for doc with real text", () => {
    expect(
      isEmptyDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello" }],
          },
        ],
      })
    ).toBe(false);
  });

  it("returns false for doc with mention only", () => {
    expect(
      isEmptyDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "mention", attrs: { id: "u1", label: "Alice" } },
            ],
          },
        ],
      })
    ).toBe(false);
  });
});
