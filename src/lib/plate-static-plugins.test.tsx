import { describe, it, expect } from "vitest";
import type { Value } from "platejs";
import { serializeHtml } from "platejs/static";
import {
  createNativeStaticEditor,
  addHeadingIds,
  prepareNativeArticle,
} from "./plate-static-plugins";
import { parseHtmlIntoSections } from "./html-sections";
import { serialiseContentToHtml } from "./resource-publish";

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

  it("serialises a toggle_v2 (container-shape) as details/summary with body children", async () => {
    // JSON is structurally nested: [{type: "toggle_v2_summary"}, ...body blocks].
    const value: Value = [
      {
        type: "toggle_v2",
        children: [
          { type: "toggle_v2_summary", children: [{ text: "Step title" }] },
          { type: "p", children: [{ text: "Body paragraph" }] },
          {
            type: "img",
            url: "/api/drive-file/in-body",
            children: [{ text: "" }],
          },
        ],
      },
    ];
    const editor = createNativeStaticEditor(value);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("Step title");
    expect(html).toContain("Body paragraph");
    expect(html).toContain("/api/drive-file/in-body");
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

  it("serialises a file attachment as an inline link", async () => {
    // FileStatic renders as a plain `<a target="_blank">` with the file
    // name — no card chrome, no download text, no size label. The visual
    // parity refactor (WS5) intentionally collapsed file attachments to
    // inline links so native articles match Google Doc article styling.
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
    expect(html).toContain('target="_blank"');
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

  it("serialises a file without size as an inline link (no size text)", async () => {
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
    // No size text rendered (FileStatic doesn't render size at all)
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

  it("INCLUDES a heading nested inside a toggle_v2_summary in the TOC (summary is always visible)", () => {
    // The summary is the clickable title row — always rendered regardless
    // of open/closed state — so a heading inside it is reachable without
    // expanding anything. Walker doesn't produce this shape, but an editor
    // could in principle structure it this way.
    const value: Value = [
      { type: "h2", children: [{ text: "Top" }] },
      {
        type: "toggle_v2",
        children: [
          {
            type: "toggle_v2_summary",
            children: [
              { type: "h3", children: [{ text: "Inside summary" }] },
            ],
          },
          { type: "p", children: [{ text: "Body" }] },
        ],
      },
    ];
    const { headings } = addHeadingIds(value);
    expect(headings).toEqual([
      { text: "Top", slug: "top", level: 2 },
      { text: "Inside summary", slug: "inside-summary", level: 3 },
    ]);
  });

  it("excludes headings inside a toggle_v2 from the TOC", () => {
    // Same in-toggle exclusion logic applies to the container-shape toggle_v2.
    // Headings still get an id so #slug deep links continue to work; they
    // just don't surface in the TOC because the reader can't see them
    // without first expanding the container.
    const value: Value = [
      { type: "h2", children: [{ text: "Top" }] },
      {
        type: "toggle_v2",
        children: [
          { type: "toggle_v2_summary", children: [{ text: "Step title" }] },
          { type: "h4", children: [{ text: "Inner H4" }] },
        ],
      },
      { type: "h2", children: [{ text: "Bottom" }] },
    ];
    const { value: result, headings } = addHeadingIds(value);

    expect(headings).toEqual([
      { text: "Top", slug: "top", level: 2 },
      { text: "Bottom", slug: "bottom", level: 2 },
    ]);

    const toggleV2 = result[1] as Record<string, unknown>;
    const toggleV2Children = toggleV2.children as Value[number][];
    const innerH4 = toggleV2Children[1] as Record<string, unknown>;
    expect(innerH4.id).toBe("inner-h4");
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

  it("excludes in-toggle headings from the TOC but keeps their id for deep linking", () => {
    // Container-shape toggle_v2: heading is a child of toggle_v2, so deep
    // link `#inside-toggle` continues to work but the heading stays out of
    // the TOC because the reader can't see it without first expanding the
    // toggle.
    const value: Value = [
      {
        type: "toggle_v2",
        children: [
          { type: "toggle_v2_summary", children: [{ text: "Toggle" }] },
          { type: "h2", children: [{ text: "Inside Toggle" }] },
        ],
      },
    ];
    const { editor, headings } = prepareNativeArticle(value);
    expect(headings).toHaveLength(0);
    return serializeHtml(editor, { stripDataAttributes: true }).then((html) => {
      expect(html).toContain('id="inside-toggle"');
    });
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

describe("Algolia pipeline (createNativeStaticEditor → parseHtmlIntoSections)", () => {
  // Regression guard for the silent section-indexing failure caught
  // 2026-06-01. Plate's static editor internally stamps every element with
  // a block-id; the default heading renderer wraps id-bearing headings in a
  // <div data-slate-id=...><h2 id=...>...</h2></div>. parseHtmlIntoSections
  // walks body.children, sees divs (not headings), and produces a single
  // null-heading section regardless of how many headings the document had.
  // The fix wires createNativeStaticEditor to a heading-component variant
  // that renders <h2> as the top-level element so parseHtmlIntoSections can
  // see it. These tests assert the pipeline-end behaviour, not the renderer
  // in isolation — both pieces correct individually doesn't help us if the
  // boundary between them is wrong.

  it("produces one Algolia section per heading on a multi-heading article", async () => {
    const value: Value = [
      { type: "h1", children: [{ text: "Title" }] },
      { type: "p", children: [{ text: "Intro paragraph." }] },
      { type: "h2", children: [{ text: "Section A" }] },
      { type: "p", children: [{ text: "Content under A." }] },
      { type: "h2", children: [{ text: "Section B" }] },
      { type: "p", children: [{ text: "Content under B." }] },
      { type: "h3", children: [{ text: "Subsection B.1" }] },
      { type: "p", children: [{ text: "Content under B.1." }] },
    ];

    const html = await serialiseContentToHtml(value);
    expect(html).not.toBeNull();
    const sections = parseHtmlIntoSections(html!);

    // 4 heading-anchored sections: Title (h1), Section A, Section B, Subsection B.1.
    // Intro paragraph rolls into the Title section's content.
    expect(sections).toHaveLength(4);
    expect(sections.map((s) => s.heading)).toEqual([
      "Title",
      "Section A",
      "Section B",
      "Subsection B.1",
    ]);
    expect(sections.map((s) => s.headingSlug)).toEqual([
      "title",
      "section-a",
      "section-b",
      "subsection-b-1",
    ]);
  });

  it("emits headings as top-level elements (not wrapped in a div)", async () => {
    // Direct shape assertion on the HTML — the previous regression was that
    // headings rendered as <div ...><h2>...</h2></div>. parseHtmlIntoSections
    // only sees direct body.children. If a heading-wrapping div ever returns
    // (e.g. someone wires the wrong components map), this test fails fast.
    const value: Value = [
      { type: "h2", children: [{ text: "Section heading" }] },
    ];
    const html = await serialiseContentToHtml(value);
    expect(html).not.toBeNull();
    // Strip whitespace for a stable assertion. The expected shape is the
    // <h2> tag at the start of the body fragment, not nested inside a div.
    const trimmed = html!.trim();
    expect(trimmed.startsWith("<h2")).toBe(true);
  });

  it("survives the full createNativeStaticEditor → serializeHtml → parseHtmlIntoSections chain end-to-end", async () => {
    // End-to-end through the exact functions the reindex path uses.
    // serialiseContentToHtml is a thin wrapper over createNativeStaticEditor
    // + serializeHtml + the <div class="slate-editor"> outer-wrapper strip.
    // The point of this test is that ANY future change to ANY step in the
    // chain — renderer, serialiser, wrapper strip, section parser — that
    // breaks the wire format gets caught.
    const value: Value = [
      { type: "h2", children: [{ text: "Welcome Pack" }] },
      { type: "h2", children: [{ text: "Using your Workspace" }] },
      { type: "h3", children: [{ text: "Accessing your email" }] },
      { type: "p", children: [{ text: "Step content." }] },
    ];
    const html = await serialiseContentToHtml(value);
    expect(html).not.toBeNull();
    const sections = parseHtmlIntoSections(html!);
    expect(sections.length).toBeGreaterThanOrEqual(3);
    const headings = sections.map((s) => s.heading);
    expect(headings).toContain("Welcome Pack");
    expect(headings).toContain("Using your Workspace");
    expect(headings).toContain("Accessing your email");
  });
});

describe("glossary block — dual-map rendering", () => {
  // Production-shape entries: an acronym carrying its expansion in parens, a
  // term with an apostrophe, a multi-word term. The toy "Advocate/Befriender"
  // case hides slug + parens edge behaviour.
  const glossaryArticle: Value = [
    { type: "h2", children: [{ text: "Terms" }] },
    {
      type: "glossary",
      variant: "terms",
      children: [
        {
          type: "glossary_entry",
          children: [
            { type: "glossary_term", children: [{ text: "Advocate" }] },
            {
              type: "glossary_definition",
              children: [{ text: "An advocate speaks up for a young person." }],
            },
          ],
        },
        {
          type: "glossary_entry",
          children: [
            { type: "glossary_term", children: [{ text: "Children's Hearing" }] },
            {
              type: "glossary_definition",
              children: [{ text: "A legal meeting about a child's care." }],
            },
          ],
        },
      ],
    },
    { type: "h2", children: [{ text: "Acronyms" }] },
    {
      type: "glossary",
      variant: "acronyms",
      children: [
        {
          type: "glossary_entry",
          children: [
            {
              type: "glossary_term",
              children: [{ text: "Compulsory Supervision Order (CSO)" }],
            },
            {
              type: "glossary_definition",
              children: [{ text: "A legal order made at a Hearing." }],
            },
          ],
        },
      ],
    },
  ] as unknown as Value;

  it("Algolia path: each term becomes its own section, slug from term text", async () => {
    const html = await serialiseContentToHtml(glossaryArticle);
    expect(html).not.toBeNull();
    const sections = parseHtmlIntoSections(html!);
    const byHeading = Object.fromEntries(
      sections.map((s) => [s.heading, s])
    );

    // Section H2s survive as their own sections.
    expect(byHeading["Terms"]).toBeDefined();
    expect(byHeading["Acronyms"]).toBeDefined();

    // Each term is its own section, with the definition as its content.
    expect(byHeading["Advocate"]).toBeDefined();
    expect(byHeading["Advocate"].headingSlug).toBe("advocate");
    expect(byHeading["Advocate"].content).toContain("speaks up");

    expect(byHeading["Children's Hearing"]).toBeDefined();
    expect(byHeading["Children's Hearing"].headingSlug).toBe("children-s-hearing");

    // Acronym keeps its parens in the heading text; slug collapses punctuation.
    expect(byHeading["Compulsory Supervision Order (CSO)"]).toBeDefined();
    expect(byHeading["Compulsory Supervision Order (CSO)"].headingSlug).toBe(
      "compulsory-supervision-order-cso"
    );
  });

  it("Algolia path: no <dl>/<dt>/<dd> wrappers leak into the indexed HTML", async () => {
    const html = await serialiseContentToHtml(glossaryArticle);
    expect(html).not.toBeNull();
    // Fragments must collapse — terms render as <h4>, not <dt> inside <dl>.
    expect(html).not.toContain("<dl");
    expect(html).not.toContain("<dt");
    expect(html).not.toContain("<dd");
    expect(html).toContain("<h4");
  });

  it("browser path: renders a <dl> with <dt id> + <dd>, terms excluded from the TOC", async () => {
    const { editor, headings } = prepareNativeArticle(glossaryArticle);
    const html = await serializeHtml(editor, { stripDataAttributes: true });

    // Definition-list semantics in the browser.
    expect(html).toContain("<dl");
    expect(html).toContain("<dd");
    // The term <dt> carries the same slug id parseHtmlIntoSections derives.
    expect(html).toContain('id="advocate"');
    expect(html).toContain('id="children-s-hearing"');

    // TOC shows only the two real H2 sections — never the 3 terms.
    expect(headings.map((h) => h.text)).toEqual(["Terms", "Acronyms"]);
  });

  it("browser path: each entry carries a data-glossary-text hook for the filter", async () => {
    const { editor } = prepareNativeArticle(glossaryArticle);
    const html = await serializeHtml(editor, { stripDataAttributes: true });
    // Lower-cased term + definition text, the hook the on-page filter reads.
    expect(html).toContain("data-glossary-text");
    expect(html.toLowerCase()).toContain("advocate speaks up for a young person");
  });
});
