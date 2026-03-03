/**
 * Tests for TiptapRenderer component.
 *
 * Covers: plain text fallback, Tiptap JSON rendering (paragraphs, lists,
 * inline marks), @mentions, href sanitisation, and edge cases.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TiptapRenderer } from "./tiptap-renderer";
import type { TiptapDocument } from "@/lib/tiptap";

// Mock linkifyText — returns the text wrapped in a span for testability
vi.mock("@/lib/url", () => ({
  linkifyText: vi.fn((text: string) => [text]),
}));

describe("TiptapRenderer", () => {
  // =============================================
  // Fallback behaviour (no JSON)
  // =============================================

  it("returns null when both json and fallback are empty", () => {
    const { container } = render(<TiptapRenderer />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when json is null and fallback is undefined", () => {
    const { container } = render(<TiptapRenderer json={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders plain text fallback when json is null", () => {
    render(<TiptapRenderer json={null} fallback="Hello world" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("calls linkifyText for plain text fallback", async () => {
    const { linkifyText } = await import("@/lib/url");
    render(<TiptapRenderer json={null} fallback="Check https://example.com" />);
    expect(linkifyText).toHaveBeenCalledWith("Check https://example.com");
  });

  // =============================================
  // JSON rendering — paragraphs and text
  // =============================================

  it("renders a simple paragraph", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello from Tiptap" }],
        },
      ],
    };
    render(<TiptapRenderer json={doc} />);
    expect(screen.getByText("Hello from Tiptap")).toBeInTheDocument();
  });

  it("renders empty paragraph as <br>", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
    const { container } = render(<TiptapRenderer json={doc} />);
    expect(container.querySelector("p br")).toBeInTheDocument();
  });

  it("renders multiple paragraphs", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First" }] },
        { type: "paragraph", content: [{ type: "text", text: "Second" }] },
      ],
    };
    render(<TiptapRenderer json={doc} />);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  // =============================================
  // Inline marks (bold, italic, strike, code)
  // =============================================

  it("renders bold text", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Bold text", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    const { container } = render(<TiptapRenderer json={doc} />);
    const strong = container.querySelector("strong");
    expect(strong).toBeInTheDocument();
    expect(strong?.textContent).toBe("Bold text");
  });

  it("renders italic text", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Italic text", marks: [{ type: "italic" }] },
          ],
        },
      ],
    };
    const { container } = render(<TiptapRenderer json={doc} />);
    expect(container.querySelector("em")).toBeInTheDocument();
  });

  it("renders strikethrough text", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Struck", marks: [{ type: "strike" }] },
          ],
        },
      ],
    };
    const { container } = render(<TiptapRenderer json={doc} />);
    expect(container.querySelector("s")).toBeInTheDocument();
  });

  it("renders inline code", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "const x = 1", marks: [{ type: "code" }] },
          ],
        },
      ],
    };
    const { container } = render(<TiptapRenderer json={doc} />);
    const code = container.querySelector("code");
    expect(code).toBeInTheDocument();
    expect(code?.textContent).toBe("const x = 1");
  });

  it("renders combined bold + italic marks", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Bold italic",
              marks: [{ type: "bold" }, { type: "italic" }],
            },
          ],
        },
      ],
    };
    const { container } = render(<TiptapRenderer json={doc} />);
    const strong = container.querySelector("strong");
    const em = container.querySelector("em");
    expect(strong).toBeInTheDocument();
    expect(em).toBeInTheDocument();
  });

  // =============================================
  // Links and href sanitisation
  // =============================================

  it("renders a valid https link", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Click here",
              marks: [
                { type: "link", attrs: { href: "https://example.com" } },
              ],
            },
          ],
        },
      ],
    };
    const { container } = render(<TiptapRenderer json={doc} />);
    const link = container.querySelector("a");
    expect(link).toBeInTheDocument();
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders a valid http link", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Link",
              marks: [
                { type: "link", attrs: { href: "http://example.com" } },
              ],
            },
          ],
        },
      ],
    };
    const { container } = render(<TiptapRenderer json={doc} />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "http://example.com"
    );
  });

  it("rejects javascript: protocol in links", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "XSS",
              marks: [
                { type: "link", attrs: { href: "javascript:alert(1)" } },
              ],
            },
          ],
        },
      ],
    };
    const { container } = render(<TiptapRenderer json={doc} />);
    // Text should render but NOT as a link
    expect(screen.getByText("XSS")).toBeInTheDocument();
    expect(container.querySelector("a")).toBeNull();
  });

  it("rejects data: protocol in links", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Data link",
              marks: [
                {
                  type: "link",
                  attrs: { href: "data:text/html,<script>alert(1)</script>" },
                },
              ],
            },
          ],
        },
      ],
    };
    const { container } = render(<TiptapRenderer json={doc} />);
    expect(container.querySelector("a")).toBeNull();
  });

  it("renders link with no href as plain text", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "No href",
              marks: [{ type: "link", attrs: {} }],
            },
          ],
        },
      ],
    };
    const { container } = render(<TiptapRenderer json={doc} />);
    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText("No href")).toBeInTheDocument();
  });

  // =============================================
  // @Mentions
  // =============================================

  it("renders @mention with label", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { id: "user-123", label: "Alice Smith" },
            },
          ],
        },
      ],
    };
    render(<TiptapRenderer json={doc} />);
    expect(screen.getByText("@Alice Smith")).toBeInTheDocument();
  });

  it("renders @mention with id fallback when label is missing", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { id: "user-456" },
            },
          ],
        },
      ],
    };
    render(<TiptapRenderer json={doc} />);
    expect(screen.getByText("@user-456")).toBeInTheDocument();
  });

  // =============================================
  // Lists
  // =============================================

  it("renders bullet list", () => {
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
    const { container } = render(<TiptapRenderer json={doc} />);
    expect(container.querySelector("ul")).toBeInTheDocument();
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText("Item one")).toBeInTheDocument();
    expect(screen.getByText("Item two")).toBeInTheDocument();
  });

  it("renders ordered list", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Step 1" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const { container } = render(<TiptapRenderer json={doc} />);
    expect(container.querySelector("ol")).toBeInTheDocument();
  });

  // =============================================
  // Hard breaks and edge cases
  // =============================================

  it("renders hardBreak as <br>", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Line one" },
            { type: "hardBreak" },
            { type: "text", text: "Line two" },
          ],
        },
      ],
    };
    const { container } = render(<TiptapRenderer json={doc} />);
    expect(container.querySelector("br")).toBeInTheDocument();
    // Text is split by <br> inside same <p>, so use container text
    expect(container.textContent).toContain("Line one");
    expect(container.textContent).toContain("Line two");
  });

  it("handles unknown node types gracefully", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "unknownBlock",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Inside unknown" }],
            },
          ],
        },
      ],
    };
    render(<TiptapRenderer json={doc} />);
    expect(screen.getByText("Inside unknown")).toBeInTheDocument();
  });

  it("handles unknown node with no children", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [{ type: "unknownEmpty" }],
    };
    const { container } = render(<TiptapRenderer json={doc} />);
    // Should not crash — renders empty
    expect(container.querySelector("div")).toBeInTheDocument();
  });

  it("accepts Record<string, unknown> as json prop (DB type compat)", () => {
    const doc: Record<string, unknown> = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Generic record" }],
        },
      ],
    };
    render(<TiptapRenderer json={doc} />);
    expect(screen.getByText("Generic record")).toBeInTheDocument();
  });
});
