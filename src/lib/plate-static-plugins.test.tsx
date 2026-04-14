import { describe, it, expect } from "vitest";
import type { Value } from "platejs";
import { serializeHtml } from "platejs/static";
import {
  createNativeStaticEditor,
  nestToggleChildren,
  addHeadingIds,
  prepareNativeArticle,
} from "./plate-static-plugins";

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

describe("addHeadingIds", () => {
  it("adds id properties to heading nodes", () => {
    const value: Value = [
      { type: "h1", children: [{ text: "Welcome" }] },
      { type: "p", children: [{ text: "Body text" }] },
      { type: "h2", children: [{ text: "Getting Started" }] },
    ];
    const { value: result, headings } = addHeadingIds(value);
    expect(headings).toHaveLength(2);
    expect(headings[0]).toEqual({ text: "Welcome", slug: "welcome", level: 1 });
    expect(headings[1]).toEqual({ text: "Getting Started", slug: "getting-started", level: 2 });
    expect((result[0] as Record<string, unknown>).id).toBe("welcome");
    expect((result[2] as Record<string, unknown>).id).toBe("getting-started");
  });

  it("does not mutate the original value", () => {
    const original: Value = [
      { type: "h2", children: [{ text: "Title" }] },
    ];
    const originalRef = original[0];
    addHeadingIds(original);
    // Original node should not have id property
    expect((originalRef as Record<string, unknown>).id).toBeUndefined();
  });

  it("deduplicates slugs for headings with identical text", () => {
    const value: Value = [
      { type: "h2", children: [{ text: "Section" }] },
      { type: "h2", children: [{ text: "Section" }] },
      { type: "h2", children: [{ text: "Section" }] },
    ];
    const { headings } = addHeadingIds(value);
    expect(headings[0].slug).toBe("section");
    expect(headings[1].slug).toBe("section-1");
    expect(headings[2].slug).toBe("section-2");
  });

  it("does not add id to paragraphs", () => {
    const value: Value = [
      { type: "p", children: [{ text: "Not a heading" }] },
    ];
    const { value: result, headings } = addHeadingIds(value);
    expect(headings).toHaveLength(0);
    expect((result[0] as Record<string, unknown>).id).toBeUndefined();
  });

  it("handles headings with inline marks", () => {
    const value: Value = [
      {
        type: "h2",
        children: [
          { text: "Bold " },
          { text: "heading", bold: true },
        ],
      },
    ];
    const { headings } = addHeadingIds(value);
    expect(headings[0].text).toBe("Bold heading");
    expect(headings[0].slug).toBe("bold-heading");
  });
});

describe("prepareNativeArticle", () => {
  it("returns an editor and headings", () => {
    const value: Value = [
      { type: "h1", children: [{ text: "Title" }] },
      { type: "p", children: [{ text: "Body" }] },
    ];
    const { editor, headings } = prepareNativeArticle(value);
    expect(editor).toBeDefined();
    expect(headings).toHaveLength(1);
    expect(headings[0].slug).toBe("title");
  });

  it("heading slugs match the editor heading IDs", async () => {
    const value: Value = [
      { type: "h2", children: [{ text: "FAQ" }] },
      { type: "p", children: [{ text: "Content" }] },
      { type: "h2", children: [{ text: "FAQ" }] },
    ];
    const { editor, headings } = prepareNativeArticle(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    // First FAQ heading should have id="faq"
    expect(html).toContain('id="faq"');
    // Second FAQ heading should have id="faq-1"
    expect(html).toContain('id="faq-1"');
    // Headings array should match
    expect(headings[0].slug).toBe("faq");
    expect(headings[1].slug).toBe("faq-1");
  });

  it("processes toggles before adding heading IDs", () => {
    const value: Value = [
      { type: "toggle", id: "t1", children: [{ text: "Toggle" }] },
      { type: "h2", indent: 1, children: [{ text: "Inside Toggle" }] },
    ];
    const { headings } = prepareNativeArticle(value);
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe("Inside Toggle");
  });
});

describe("createNativeStaticEditor (Algolia path)", () => {
  it("does NOT add heading IDs", async () => {
    const value: Value = [
      { type: "h2", children: [{ text: "Clean Heading" }] },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    // Should not have id attribute (clean for Algolia)
    expect(html).not.toContain('id="clean-heading"');
    expect(html).toContain("Clean Heading");
  });
});

describe("ImageStatic alignment", () => {
  it("centres images by default", async () => {
    const value: Value = [
      { type: "img", url: "/test.png", children: [{ text: "" }] },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("mx-auto");
  });

  it("applies left alignment", async () => {
    const value: Value = [
      { type: "img", url: "/test.png", align: "left", children: [{ text: "" }] },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).not.toContain("mx-auto");
    expect(html).not.toContain("ml-auto");
  });

  it("applies right alignment", async () => {
    const value: Value = [
      { type: "img", url: "/test.png", align: "right", children: [{ text: "" }] },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("ml-auto");
  });
});

describe("MediaEmbedStatic", () => {
  it("uses aspect-video class", async () => {
    const value: Value = [
      {
        type: "media_embed",
        url: "https://www.youtube-nocookie.com/embed/test",
        children: [{ text: "" }],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("aspect-video");
    expect(html).toContain("not-prose");
    expect(html).toContain("bg-muted");
    // Should NOT use the old paddingBottom trick
    expect(html).not.toContain("padding-bottom");
  });
});

describe("TableCellStatic styling", () => {
  it("does not have explicit padding or border classes", async () => {
    const value: Value = [
      {
        type: "table",
        children: [
          {
            type: "tr",
            children: [
              { type: "td", children: [{ type: "p", children: [{ text: "Cell" }] }] },
            ],
          },
        ],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    // td should only have align-top, not p-2 or border classes
    expect(html).toContain("align-top");
    expect(html).not.toMatch(/class="[^"]*p-2[^"]*"/);
  });
});

describe("ColumnItemStatic prose modifiers", () => {
  it("includes content modifier classes", async () => {
    const value: Value = [
      {
        type: "column_group",
        layout: [50, 50],
        children: [
          { type: "column", width: "50%", children: [{ type: "p", children: [{ text: "Col" }] }] },
        ],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    // Column items should have the full modifier chain
    expect(html).toContain("prose-headings:font-semibold");
    expect(html).toContain("prose-p:text-foreground/85");
  });
});

describe("heading HTML structure for Algolia", () => {
  /** Strip Plate's <div class="slate-editor"> wrapper (same as serialiseContentToHtml). */
  function stripEditorWrapper(html: string): string {
    const match = html.match(/^<div[^>]*>([\s\S]*)<\/div>$/);
    return match ? match[1] : html;
  }

  it("headings render as top-level elements (no wrapper div)", async () => {
    const value: Value = [
      { type: "h2", children: [{ text: "Section One" }] },
      { type: "p", children: [{ text: "Content" }] },
    ];
    const editor = createNativeStaticEditor(value);
    const html = stripEditorWrapper(
      await serializeHtml(editor, { stripDataAttributes: true })
    );
    // h2 should be rendered directly (via as="h2"), not wrapped in <div><h2>
    expect(html).toMatch(/<h2[^>]*>.*Section One/);
    expect(html).not.toMatch(/<div[^>]*><h2/);
  });

  it("section extraction finds headings after wrapper stripping", async () => {
    const { parseHtmlIntoSections } = await import("./html-sections");
    const value: Value = [
      { type: "p", children: [{ text: "Intro text" }] },
      { type: "h2", children: [{ text: "First Section" }] },
      { type: "p", children: [{ text: "Body of first" }] },
      { type: "h2", children: [{ text: "Second Section" }] },
      { type: "p", children: [{ text: "Body of second" }] },
    ];
    const editor = createNativeStaticEditor(value);
    const html = stripEditorWrapper(
      await serializeHtml(editor, { stripDataAttributes: true })
    );
    const sections = parseHtmlIntoSections(html);
    expect(sections.length).toBe(3);
    expect(sections[0].heading).toBeNull();
    expect(sections[1].heading).toBe("First Section");
    expect(sections[2].heading).toBe("Second Section");
  });
});

describe("LinkStatic internal vs external", () => {
  it("internal link has no target attribute", async () => {
    const value: Value = [
      {
        type: "p",
        children: [
          {
            type: "a",
            url: "/resources/article/some-article",
            children: [{ text: "Internal" }],
          },
        ],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("/resources/article/some-article");
    expect(html).toContain("Internal");
    expect(html).not.toContain("target=");
  });

  it("external link has target=_blank", async () => {
    const value: Value = [
      {
        type: "p",
        children: [
          {
            type: "a",
            url: "https://example.com",
            children: [{ text: "External" }],
          },
        ],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("https://example.com");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("protocol-relative URL is treated as external", async () => {
    const value: Value = [
      {
        type: "p",
        children: [
          {
            type: "a",
            url: "//evil.com/path",
            children: [{ text: "Sneaky" }],
          },
        ],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain('target="_blank"');
  });

  it("absolute intranet URL is stripped to relative path (same tab)", async () => {
    // This test depends on NEXT_PUBLIC_APP_URL being set.
    // If unset, absolute URLs are treated as external (safe fallback).
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) return; // skip if env var not set

    const value: Value = [
      {
        type: "p",
        children: [
          {
            type: "a",
            url: `${appUrl}/resources/article/some-article`,
            children: [{ text: "Absolute internal" }],
          },
        ],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("/resources/article/some-article");
    expect(html).not.toContain('target=');
  });
});
