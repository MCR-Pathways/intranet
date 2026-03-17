import { describe, it, expect } from "vitest";
import {
  extractDocId,
  extractFolderId,
  sanitiseGoogleDocsHtml,
  extractPlainTextFromHtml,
} from "./google-drive";

// =============================================
// extractDocId
// =============================================

describe("extractDocId", () => {
  it("extracts ID from standard Google Docs URL", () => {
    expect(
      extractDocId(
        "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
  });

  it("extracts ID from Google Docs view URL", () => {
    expect(
      extractDocId(
        "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
  });

  it("extracts ID from Google Docs URL without trailing path", () => {
    expect(
      extractDocId(
        "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
  });

  it("extracts ID from Google Drive file URL", () => {
    expect(
      extractDocId(
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
  });

  it("extracts ID from Google Drive open URL", () => {
    expect(
      extractDocId(
        "https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
  });

  it("handles IDs with hyphens and underscores", () => {
    expect(
      extractDocId(
        "https://docs.google.com/document/d/1A-b_C-d_E/edit"
      )
    ).toBe("1A-b_C-d_E");
  });

  it("returns null for non-Google URLs", () => {
    expect(extractDocId("https://example.com/document/123")).toBeNull();
  });

  it("returns null for invalid URLs", () => {
    expect(extractDocId("not-a-url")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractDocId("")).toBeNull();
  });

  it("returns null for Google Drive folder URLs (not a doc)", () => {
    expect(
      extractDocId("https://drive.google.com/drive/folders/1AbCdEfGhI")
    ).toBeNull();
  });
});

// =============================================
// extractFolderId
// =============================================

describe("extractFolderId", () => {
  it("extracts ID from standard Drive folder URL", () => {
    expect(
      extractFolderId(
        "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrSt"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrSt");
  });

  it("extracts ID from Drive folder URL with user prefix", () => {
    expect(
      extractFolderId(
        "https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOpQrSt"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrSt");
  });

  it("extracts ID from Drive folder URL with query params", () => {
    expect(
      extractFolderId(
        "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrSt?resourcekey=abc"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrSt");
  });

  it("returns null for Google Docs URL", () => {
    expect(
      extractFolderId(
        "https://docs.google.com/document/d/1AbCdEfGhI/edit"
      )
    ).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(extractFolderId("not-a-url")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractFolderId("")).toBeNull();
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

  it("preserves table elements", () => {
    const input = '<html><body><table style="width:100%"><tr><td style="border:1px solid">Cell</td></tr></table></body></html>';
    const result = sanitiseGoogleDocsHtml(input);
    expect(result).toContain("<table>");
    expect(result).toContain("<td>Cell</td>");
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

  it("handles headings and paragraphs", () => {
    // textContent concatenates without spaces between block elements
    expect(
      extractPlainTextFromHtml("<h1>Title</h1><p>Content here.</p>")
    ).toBe("TitleContent here.");
  });

  it("handles list items", () => {
    expect(
      extractPlainTextFromHtml("<ul><li>One</li><li>Two</li></ul>")
    ).toBe("OneTwo");
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
