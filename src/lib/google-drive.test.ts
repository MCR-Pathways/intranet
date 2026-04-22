import { describe, it, expect } from "vitest";
import {
  extractDocId,
  extractFolderId,
  sanitiseGoogleDocsHtml,
  extractPlainTextFromHtml,
  truncateSyncError,
} from "./google-drive";

// Re-export smoke test — verify extractDocId/extractFolderId still work via google-drive.ts
describe("re-exported URL parsers", () => {
  it("extractDocId works via re-export", () => {
    expect(
      extractDocId("https://docs.google.com/document/d/ABC123/edit")
    ).toBe("ABC123");
  });

  it("extractFolderId works via re-export", () => {
    expect(
      extractFolderId("https://drive.google.com/drive/folders/XYZ789")
    ).toBe("XYZ789");
  });
});

// =============================================
// sanitiseGoogleDocsHtml
// =============================================

describe("sanitiseGoogleDocsHtml", () => {
  it("strips inline style attributes", () => {
    const input = '<html><body><p style="color: red; font-size: 14px;">Hello</p></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).toBe("<p>Hello</p>");
    expect(result).not.toContain("style=");
  });

  it("strips class attributes", () => {
    const input = '<html><body><p class="c1 doc-content">Hello</p></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).toBe("<p>Hello</p>");
    expect(result).not.toContain("class=");
  });

  it("removes <style> tags", () => {
    const input = "<html><head><style>.c1{color:red}</style></head><body><p>Hello</p></body></html>";
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).not.toContain("<style>");
    expect(result).not.toContain("color:red");
  });

  it("removes <script> tags", () => {
    const input = '<html><body><script>alert("xss")</script><p>Hello</p></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
  });

  it("removes empty span elements", () => {
    const input = "<html><body><p><span></span>Hello<span>  </span></p></body></html>";
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).not.toContain("<span></span>");
  });

  it("unwraps spans with no attributes", () => {
    const input = '<html><body><p><span>Hello world</span></p></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).toBe("<p>Hello world</p>");
  });

  it("strips data-* attributes", () => {
    const input = '<html><body><p data-docs-internal="true" data-aria="label">Hello</p></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).not.toContain("data-");
  });

  it("sanitises javascript: hrefs", () => {
    const input = '<html><body><a href="javascript:alert(1)">Click me</a></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).not.toContain("javascript:");
  });

  it("preserves valid https links and adds target/rel", () => {
    const input = '<html><body><a href="https://example.com">Link</a></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it("preserves heading elements", () => {
    const input = '<html><body><h1 style="color:blue">Title</h1><h2 class="c2">Subtitle</h2></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).toContain("<h1>Title</h1>");
    expect(result).toContain("<h2>Subtitle</h2>");
  });

  it("preserves list elements", () => {
    const input = '<html><body><ul style="margin:0"><li style="padding:0">Item 1</li><li>Item 2</li></ul></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>Item 1</li>");
    expect(result).toContain("<li>Item 2</li>");
  });

  it("preserves table elements and promotes first row to th", () => {
    const input = '<html><body><table style="width:100%"><tr><td style="border:1px solid">Header</td></tr><tr><td>Cell</td></tr></table></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).toContain("<table>");
    expect(result).toContain("<th>Header</th>");
    expect(result).toContain("<td>Cell</td>");
  });

  it("converts bold spans to strong tags", () => {
    const input = '<html><body><p><span style="font-weight:700">Bold text</span></p></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).toContain("<strong>Bold text</strong>");
    expect(result).not.toContain("<span");
  });

  it("converts italic spans to em tags", () => {
    const input = '<html><body><p><span style="font-style:italic">Italic text</span></p></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).toContain("<em>Italic text</em>");
  });

  it("converts bold+italic spans to nested strong+em", () => {
    const input = '<html><body><p><span style="font-weight:700;font-style:italic">Both</span></p></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).toContain("<strong><em>Both</em></strong>");
  });

  it("preserves table column widths as percentages", () => {
    const input = '<html><body><table><tr><td style="width:200px">A</td><td style="width:300px">B</td></tr><tr><td>C</td><td>D</td></tr></table></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).toContain('style="width:40%"');
    expect(result).toContain('style="width:60%"');
  });

  it("skips column widths when no width styles present", () => {
    const input = '<html><body><table><tr><td>A</td><td>B</td></tr></table></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).toContain("<th>A</th>");
    expect(result).not.toContain("style=");
  });

  it("returns empty string for empty HTML", () => {
    expect(sanitiseGoogleDocsHtml("")).toBe("");
  });

  it("handles HTML without body tag", () => {
    const input = "<p>Hello</p>";
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).toContain("Hello");
  });
});

// =============================================
// extractPlainTextFromHtml
// =============================================

describe("extractPlainTextFromHtml", () => {
  it("extracts text from HTML elements", () => {
    expect(
      extractPlainTextFromHtml("<p>Hello <b>world</b></p>")
    ).toBe("Hello world");
  });

  it("separates text from headings and paragraphs", () => {
    expect(
      extractPlainTextFromHtml("<h1>Title</h1><p>Content here.</p>")
    ).toBe("Title Content here.");
  });

  it("separates list items with spaces", () => {
    expect(
      extractPlainTextFromHtml("<ul><li>One</li><li>Two</li></ul>")
    ).toBe("One Two");
  });

  it("normalises whitespace", () => {
    expect(
      extractPlainTextFromHtml("<p>  Hello   \n\n  world  </p>")
    ).toBe("Hello world");
  });

  it("returns empty string for empty HTML", () => {
    expect(extractPlainTextFromHtml("")).toBe("");
  });
});

describe("sanitiseGoogleDocsHtml — image alignment", () => {
  it("applies mx-auto to centred images", () => {
    const html = `<html><body><p style="text-align:center"><span><img src="https://lh7-us.googleusercontent.com/abc" style="width:400px"></span></p></body></html>`;
    const result = sanitiseGoogleDocsHtml(html);
    expect(result).toContain('class="mx-auto"');
    // Style should be stripped but class preserved on the img
    expect(result).not.toContain("text-align");
  });

  it("applies ml-auto to right-aligned images", () => {
    const html = `<html><body><p style="text-align:right;line-height:1.5"><span><img src="https://lh7-us.googleusercontent.com/abc" style="width:200px"></span></p></body></html>`;
    const result = sanitiseGoogleDocsHtml(html);
    expect(result).toContain('class="ml-auto"');
  });

  it("does not add alignment class to paragraphs without images", () => {
    const html = `<html><body><p style="text-align:center"><span style="font-weight:700">Centred text</span></p></body></html>`;
    const result = sanitiseGoogleDocsHtml(html);
    expect(result).not.toContain("mx-auto");
    expect(result).not.toContain("ml-auto");
  });

  it("does not add class for left-aligned or unstyled image paragraphs", () => {
    const html = `<html><body><p><span><img src="https://lh7-us.googleusercontent.com/abc"></span></p></body></html>`;
    const result = sanitiseGoogleDocsHtml(html);
    expect(result).not.toContain("mx-auto");
    expect(result).not.toContain("ml-auto");
  });
});

describe("truncateSyncError", () => {
  it("returns short messages unchanged", () => {
    expect(truncateSyncError("403 Forbidden")).toBe("403 Forbidden");
  });

  it("returns exactly-at-limit messages unchanged", () => {
    const msg = "x".repeat(500);
    expect(truncateSyncError(msg)).toBe(msg);
    expect(truncateSyncError(msg).length).toBe(500);
  });

  it("truncates over-limit messages and appends an ellipsis", () => {
    const msg = "x".repeat(1000);
    const result = truncateSyncError(msg);
    expect(result.length).toBe(500);
    expect(result.endsWith("…")).toBe(true);
    expect(result.slice(0, 499)).toBe("x".repeat(499));
  });

  it("respects a custom max", () => {
    const result = truncateSyncError("abcdefghij", 5);
    expect(result).toBe("abcd…");
    expect(result.length).toBe(5);
  });
});
