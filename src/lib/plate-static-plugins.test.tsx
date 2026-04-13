import { describe, it, expect } from "vitest";
import type { Value } from "platejs";
import { serializeHtml } from "platejs/static";
import { createNativeStaticEditor, nestToggleChildren } from "./plate-static-plugins";

describe("createNativeStaticEditor", () => {
  it("creates an editor with the given value", () => {
    const value: Value = [{ type: "p", children: [{ text: "Hello" }] }];
    const editor = createNativeStaticEditor(value);
    expect(editor).toBeDefined();
    expect(editor.children).toEqual(value);
  });
});

describe("serializeHtml", () => {
  it("serialises a paragraph", async () => {
    const value: Value = [{ type: "p", children: [{ text: "Hello world" }] }];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("Hello world");
    expect(html).toContain("<p");
  });

  it("serialises headings", async () => {
    const value: Value = [
      { type: "h1", children: [{ text: "Title" }] },
      { type: "h2", children: [{ text: "Subtitle" }] },
      { type: "h3", children: [{ text: "Section" }] },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("<h1");
    expect(html).toContain("Title");
    expect(html).toContain("<h2");
    expect(html).toContain("Subtitle");
    expect(html).toContain("<h3");
    expect(html).toContain("Section");
  });

  it("serialises bold and italic marks", async () => {
    const value: Value = [
      {
        type: "p",
        children: [
          { text: "Normal " },
          { text: "bold", bold: true },
          { text: " " },
          { text: "italic", italic: true },
        ],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("<strong");
    expect(html).toContain("bold");
    expect(html).toContain("<em");
    expect(html).toContain("italic");
  });

  it("serialises a link", async () => {
    const value: Value = [
      {
        type: "p",
        children: [
          {
            type: "a",
            url: "https://example.com",
            children: [{ text: "Click here" }],
          },
        ],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("https://example.com");
    expect(html).toContain("Click here");
    expect(html).toContain("<a");
  });

  it("serialises a blockquote", async () => {
    const value: Value = [
      { type: "blockquote", children: [{ text: "Quote text" }] },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("<blockquote");
    expect(html).toContain("Quote text");
  });

  it("serialises a horizontal rule", async () => {
    const value: Value = [
      { type: "p", children: [{ text: "Above" }] },
      { type: "hr", children: [{ text: "" }] },
      { type: "p", children: [{ text: "Below" }] },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("<hr");
  });

  it("serialises underline and strikethrough", async () => {
    const value: Value = [
      {
        type: "p",
        children: [
          { text: "underlined", underline: true },
          { text: " " },
          { text: "struck", strikethrough: true },
        ],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("<u");
    expect(html).toContain("underlined");
    expect(html).toContain("<s");
    expect(html).toContain("struck");
  });

  it("serialises a callout with variant and role", async () => {
    const value: Value = [
      {
        type: "callout",
        variant: "warning",
        children: [{ text: "Be careful here" }],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain('role="note"');
    expect(html).toContain("Be careful here");
    // Warning variant uses amber Tailwind classes
    expect(html).toContain("bg-amber-50");
  });

  it("serialises a callout with default info variant", async () => {
    const value: Value = [
      {
        type: "callout",
        children: [{ text: "Info note" }],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain('role="note"');
    expect(html).toContain("Info note");
    // Info variant uses blue Tailwind classes
    expect(html).toContain("bg-blue-50");
  });

  it("serialises a table with header and body rows", async () => {
    const value: Value = [
      {
        type: "table",
        colSizes: [200, 200],
        children: [
          {
            type: "tr",
            children: [
              { type: "th", children: [{ type: "p", children: [{ text: "Name" }] }] },
              { type: "th", children: [{ type: "p", children: [{ text: "Role" }] }] },
            ],
          },
          {
            type: "tr",
            children: [
              { type: "td", children: [{ type: "p", children: [{ text: "Alice" }] }] },
              { type: "td", children: [{ type: "p", children: [{ text: "Engineer" }] }] },
            ],
          },
        ],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("<td");
    expect(html).toContain("Name");
    expect(html).toContain("Alice");
    expect(html).toContain("Engineer");
  });

  it("serialises a column layout with flex", async () => {
    const value: Value = [
      {
        type: "column_group",
        layout: [50, 50],
        children: [
          {
            type: "column",
            width: "50%",
            children: [{ type: "p", children: [{ text: "Left side" }] }],
          },
          {
            type: "column",
            width: "50%",
            children: [{ type: "p", children: [{ text: "Right side" }] }],
          },
        ],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("display:flex");
    expect(html).toContain("Left side");
    expect(html).toContain("Right side");
    expect(html).toContain("not-prose");
  });

  it("serialises a toggle as details/summary", async () => {
    const value: Value = [
      {
        type: "toggle",
        id: "t1",
        children: [{ text: "FAQ question" }],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("FAQ question");
  });

  it("serialises an image with alt text and dimensions", async () => {
    const value: Value = [
      {
        type: "img",
        url: "/api/drive-file/abc123",
        alt: "Team photo",
        width: 800,
        height: 600,
        children: [{ text: "" }],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("<img");
    expect(html).toContain("/api/drive-file/abc123");
    expect(html).toContain('alt="Team photo"');
    expect(html).toContain('loading="lazy"');
  });

  it("serialises a video embed with sandbox", async () => {
    const value: Value = [
      {
        type: "media_embed",
        url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
        children: [{ text: "" }],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("<iframe");
    expect(html).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(html).toContain("sandbox");
  });

  it("serialises a file attachment with download link", async () => {
    const value: Value = [
      {
        type: "file",
        url: "/api/drive-file/xyz789",
        name: "Policy Document.pdf",
        size: 2500000,
        children: [{ text: "" }],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("/api/drive-file/xyz789");
    expect(html).toContain("Policy Document.pdf");
    expect(html).toContain("2.4 MB");
    expect(html).toContain("Download");
  });

  it("serialises an image without dimensions (paste scenario)", async () => {
    const value: Value = [
      {
        type: "img",
        url: "/api/drive-file/no-dims",
        children: [{ text: "" }],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("<img");
    expect(html).toContain("/api/drive-file/no-dims");
    expect(html).not.toContain("width=");
    expect(html).not.toContain("height=");
  });

  it("serialises an image with width only (height auto via style)", async () => {
    const value: Value = [
      {
        type: "img",
        url: "/api/drive-file/wide",
        width: 600,
        children: [{ text: "" }],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain('width="600"');
    expect(html).toContain("height");
    // height: auto is applied via style to preserve aspect ratio
    expect(html).toContain("auto");
  });

  it("serialises a file without size", async () => {
    const value: Value = [
      {
        type: "file",
        url: "/api/drive-file/nosize",
        name: "Report.pdf",
        children: [{ text: "" }],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("Report.pdf");
    expect(html).toContain("Download");
    // No size text rendered
    expect(html).not.toContain("MB");
    expect(html).not.toContain("KB");
  });

  it("serialises a video embed with title attribute", async () => {
    const value: Value = [
      {
        type: "media_embed",
        url: "https://player.vimeo.com/video/123456",
        children: [{ text: "" }],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain('title="Embedded video"');
    expect(html).toContain("sandbox");
  });

  it("produces non-empty output for a mixed document", async () => {
    const value: Value = [
      { type: "h1", children: [{ text: "Welcome" }] },
      { type: "p", children: [{ text: "Introduction text with " }, { text: "bold", bold: true }] },
      { type: "blockquote", children: [{ text: "A quote" }] },
      { type: "hr", children: [{ text: "" }] },
      { type: "p", children: [{ text: "Closing paragraph" }] },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain("Welcome");
    expect(html).toContain("Introduction text");
    expect(html).toContain("A quote");
    expect(html).toContain("Closing paragraph");
  });
});

describe("nestToggleChildren", () => {
  it("returns value unchanged when no toggles present", () => {
    const value: Value = [
      { type: "p", children: [{ text: "Hello" }] },
      { type: "h1", children: [{ text: "Title" }] },
    ];
    const result = nestToggleChildren(value);
    expect(result).toEqual(value);
  });

  it("handles a toggle at end of document with no children", () => {
    const value: Value = [
      { type: "p", children: [{ text: "Before" }] },
      { type: "toggle", id: "t1", children: [{ text: "Empty toggle" }] },
    ];
    const result = nestToggleChildren(value);
    expect(result).toHaveLength(2);
    const toggle = result[1] as Record<string, unknown>;
    expect(toggle.type).toBe("toggle");
    // Children should be just the toggle_summary wrapper (no nested content)
    const children = toggle.children as Record<string, unknown>[];
    expect(children).toHaveLength(1);
    expect(children[0].type).toBe("toggle_summary");
  });

  it("nests indented siblings after a toggle", () => {
    const value: Value = [
      { type: "toggle", id: "t1", children: [{ text: "Question" }] },
      { type: "p", indent: 1, children: [{ text: "Answer line 1" }] },
      { type: "p", indent: 1, children: [{ text: "Answer line 2" }] },
      { type: "p", children: [{ text: "After toggle" }] },
    ];
    const result = nestToggleChildren(value);
    expect(result).toHaveLength(2);

    const toggle = result[0] as Record<string, unknown>;
    expect(toggle.type).toBe("toggle");
    const children = toggle.children as Record<string, unknown>[];
    // toggle_summary + 2 nested paragraphs
    expect(children).toHaveLength(3);
    expect(children[0].type).toBe("toggle_summary");
    expect(children[1].type).toBe("p");
    expect(children[2].type).toBe("p");

    expect((result[1] as Record<string, unknown>).type).toBe("p");
  });

  it("handles consecutive toggles with no content between", () => {
    const value: Value = [
      { type: "toggle", id: "t1", children: [{ text: "Q1" }] },
      { type: "toggle", id: "t2", children: [{ text: "Q2" }] },
    ];
    const result = nestToggleChildren(value);
    expect(result).toHaveLength(2);
    // Each toggle has just a toggle_summary child
    const t1Children = (result[0] as Record<string, unknown>).children as Record<string, unknown>[];
    expect(t1Children).toHaveLength(1);
    expect(t1Children[0].type).toBe("toggle_summary");
    const t2Children = (result[1] as Record<string, unknown>).children as Record<string, unknown>[];
    expect(t2Children).toHaveLength(1);
    expect(t2Children[0].type).toBe("toggle_summary");
  });

  it("handles nested toggles", () => {
    const value: Value = [
      { type: "toggle", id: "t1", children: [{ text: "Outer" }] },
      { type: "p", indent: 1, children: [{ text: "Outer content" }] },
      { type: "toggle", id: "t2", indent: 1, children: [{ text: "Inner" }] },
      { type: "p", indent: 2, children: [{ text: "Inner content" }] },
      { type: "p", indent: 1, children: [{ text: "Back to outer" }] },
      { type: "p", children: [{ text: "Outside" }] },
    ];
    const result = nestToggleChildren(value);
    expect(result).toHaveLength(2); // outer toggle + "Outside" paragraph

    const outer = result[0] as Record<string, unknown>;
    const outerChildren = outer.children as Record<string, unknown>[];
    // toggle_summary + "Outer content" + nested toggle + "Back to outer"
    expect(outerChildren).toHaveLength(4);
    expect(outerChildren[0].type).toBe("toggle_summary");

    const innerToggle = outerChildren[2] as Record<string, unknown>;
    expect(innerToggle.type).toBe("toggle");
    const innerChildren = innerToggle.children as Record<string, unknown>[];
    // toggle_summary + "Inner content"
    expect(innerChildren).toHaveLength(2);
    expect(innerChildren[0].type).toBe("toggle_summary");
  });

  it("does not nest indented content that does not follow a toggle", () => {
    const value: Value = [
      { type: "p", indent: 1, children: [{ text: "Indented but no toggle" }] },
      { type: "p", children: [{ text: "Normal" }] },
    ];
    const result = nestToggleChildren(value);
    expect(result).toHaveLength(2);
    // Left as-is since no toggle precedes the indented content
    expect(result).toEqual(value);
  });
});
