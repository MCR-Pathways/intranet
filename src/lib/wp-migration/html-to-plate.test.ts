/**
 * Walker tests. Each test isolates a specific structural transformation
 * driven by the design audit (memory/wp-migration-design-audit.md).
 * The walker is shared between the WP migration script and the Resources
 * "Import HTML" feature, so behaviour changes here affect both surfaces.
 */
import { describe, it, expect } from "vitest";
import { htmlToPlate } from "./html-to-plate";

describe("htmlToPlate — heading handling", () => {
  it("demotes a body-level H1 to H2", () => {
    const html = `<h1>In-body title</h1><p>body content</p>`;
    const { value } = htmlToPlate(html);
    expect(value).toEqual([
      {
        type: "h2",
        children: [{ text: "In-body title" }],
      },
      {
        type: "p",
        children: [{ text: "body content" }],
      },
    ]);
  });

  it("demotes multiple H1s when several appear in the body", () => {
    const html = `<h1>First</h1><p>x</p><h1>Second</h1>`;
    const { value } = htmlToPlate(html);
    const headings = value.filter((n) => /^h[1-6]$/.test((n as { type: string }).type));
    expect(headings.every((h) => (h as { type: string }).type === "h2")).toBe(true);
    expect(headings).toHaveLength(2);
  });

  it("preserves H2, H3, H4 verbatim", () => {
    const html = `<h2>Two</h2><h3>Three</h3><h4>Four</h4>`;
    const { value } = htmlToPlate(html);
    expect(value.map((n) => (n as { type: string }).type)).toEqual(["h2", "h3", "h4"]);
  });
});
