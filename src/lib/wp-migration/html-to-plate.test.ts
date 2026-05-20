/**
 * Walker tests. Each test isolates a specific structural transformation
 * driven by the design audit (memory/wp-migration-design-audit.md).
 * The walker is shared between the WP migration script and the Resources
 * "Import HTML" feature, so behaviour changes here affect both surfaces.
 */
import { describe, it, expect } from "vitest";
import { htmlToPlate } from "./html-to-plate";

describe("htmlToPlate — Elementor Toggle widget orphan-link promotion", () => {
  it("promotes a block-level <a class='elementor-toggle-title'> to H2 when no prior heading exists", () => {
    // pc-support's "PC Guidebook" pattern — Elementor Toggle title sitting
    // before the page's first heading. Should become a top-level section.
    const html = `<div class="elementor-toggle-item"><div class="elementor-tab-title"><a class="elementor-toggle-title">PC Guidebook</a></div><div class="elementor-tab-content"><p>The PC Guidebooks are detailed guides...</p></div></div>`;
    const { value } = htmlToPlate(html);
    expect(value[0]).toEqual({ type: "h2", children: [{ text: "PC Guidebook" }] });
    expect(value[1]).toEqual({
      type: "p",
      children: [{ text: "The PC Guidebooks are detailed guides..." }],
    });
  });

  it("promotes orphan Elementor toggle to H3 when prior heading is H2", () => {
    // group-work's themes — they sit under the "Themes" H2.
    const html = `<h2>Group Work Themes</h2><div class="elementor-toggle-item"><div class="elementor-tab-title"><a class="elementor-toggle-title">Health & Wellbeing</a></div><div class="elementor-tab-content"><p>Activities for health.</p></div></div>`;
    const { value } = htmlToPlate(html);
    expect(value).toEqual([
      { type: "h2", children: [{ text: "Group Work Themes" }] },
      { type: "h3", children: [{ text: "Health & Wellbeing" }] },
      { type: "p", children: [{ text: "Activities for health." }] },
    ]);
  });

  it("promotes orphan Elementor toggle to H4 when prior heading is H3", () => {
    // new-staff-info's step-titles — sit under H3 sections like
    // "Setting Up My Email".
    const html = `<h3>Setting Up My Email</h3><div class="elementor-toggle-item"><div class="elementor-tab-title"><a class="elementor-toggle-title">Accessing your work email</a></div><div class="elementor-tab-content"><p>Step content.</p></div></div>`;
    const { value } = htmlToPlate(html);
    expect(value).toEqual([
      { type: "h3", children: [{ text: "Setting Up My Email" }] },
      { type: "h4", children: [{ text: "Accessing your work email" }] },
      { type: "p", children: [{ text: "Step content." }] },
    ]);
  });

  it("treats href='#' as a navigation marker (Elementor Toggle convention)", () => {
    const html = `<a href="#" class="elementor-toggle-title">Theme name</a>`;
    const { value } = htmlToPlate(html);
    expect(value[0]).toEqual({ type: "h2", children: [{ text: "Theme name" }] });
  });

  it("treats <a name='bookmark'> empty anchor as navigation marker at block level", () => {
    const html = `<a name="advocate">Advocate</a>`;
    const { value } = htmlToPlate(html);
    expect(value[0]).toEqual({ type: "h2", children: [{ text: "Advocate" }] });
  });

  it("does NOT promote a normal link to heading", () => {
    // Real <a href="..."> should stay as a paragraph-wrapped inline link.
    const html = `<a href="https://example.com/">External link</a>`;
    const { value } = htmlToPlate(html);
    expect((value[0] as { type: string }).type).toBe("p");
    const inline = (value[0] as { children: unknown[] }).children;
    expect((inline[0] as { type: string }).type).toBe("a");
  });

  it("drops empty navigation-marker anchors inside paragraphs without promoting the paragraph", () => {
    // WP's <p><a name="advocate"></a>Advocate</p> pattern.
    // The empty anchor is dropped; the paragraph stays as a paragraph
    // (jargon-style glossary uses this pattern, and the right shape needs
    // the glossary primitive, not a generic walker promotion).
    const html = `<p><a name="advocate"></a>Advocate</p>`;
    const { value } = htmlToPlate(html);
    expect(value).toEqual([
      { type: "p", children: [{ text: "Advocate" }] },
    ]);
  });
});

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
