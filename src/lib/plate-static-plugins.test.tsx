import { describe, it, expect } from "vitest";
import type { Value } from "platejs";
import { serializeHtml } from "platejs/static";
import { createNativeStaticEditor } from "./plate-static-plugins";

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
