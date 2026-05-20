/**
 * Walker tests. Each test isolates a specific structural transformation
 * driven by the design audit (memory/wp-migration-design-audit.md).
 * The walker is shared between the WP migration script and the Resources
 * "Import HTML" feature, so behaviour changes here affect both surfaces.
 */
import { describe, it, expect } from "vitest";
import { htmlToPlate } from "./html-to-plate";

describe("htmlToPlate — image-wrapped-in-link (clickable-image-preview pattern)", () => {
  it("emits the image as a link target, not the bare filename", () => {
    // WP pattern: <a href="x.pdf"><img src="screenshot.png"/></a>
    // Author's intent: clickable screenshot opens the PDF.
    // Before this fix, the walker walked the <a> element via walkInline,
    // saw it had no textContent (the <img> contributes none), and emitted
    // a link labelled with the filename — losing the image entirely.
    const assetMap = new Map([
      [
        "https://i.mcrpathways.org/wp-content/uploads/2025/11/Welcome-Pack.pdf",
        {
          fileId: "PDF_ID",
          mimeType: "application/pdf",
          fileName: "Welcome-Pack.pdf",
          size: 1000,
        },
      ],
      [
        "https://i.mcrpathways.org/wp-content/uploads/2025/11/Screenshot.png",
        {
          fileId: "IMG_ID",
          mimeType: "image/png",
          fileName: "Screenshot.png",
          size: 500,
        },
      ],
    ]);
    const html = `<a href="https://i.mcrpathways.org/wp-content/uploads/2025/11/Welcome-Pack.pdf"><img src="https://i.mcrpathways.org/wp-content/uploads/2025/11/Screenshot.png" alt="Welcome Pack screenshot" /></a>`;
    const { value, warnings } = htmlToPlate(html, assetMap);
    // The image must survive — it's the visual preview the author placed.
    const imgNode = value.find(
      (n) => (n as { type: string }).type === "img",
    ) as { type: string; url: string };
    expect(imgNode).toBeDefined();
    expect(imgNode.url).toBe("/api/drive-file/IMG_ID");
    // There should be NO orphan "Welcome-Pack.pdf" filename-labelled link.
    const flatText = JSON.stringify(value);
    expect(flatText).not.toContain("Welcome-Pack.pdf");
    expect(warnings).toEqual([]);
  });

  it("emits a warning when an anchor falls back to the filename for visible text", () => {
    // Catch-all for the underlying issue: any <a> with no inner text and
    // a WP-asset href will silently render the raw filename. Surface a
    // warning so operators see these on the migration log.
    const assetMap = new Map([
      [
        "https://i.mcrpathways.org/wp-content/uploads/2025/11/Doc.pdf",
        {
          fileId: "DOC_ID",
          mimeType: "application/pdf",
          fileName: "Doc.pdf",
          size: 1000,
        },
      ],
    ]);
    const html = `<p><a href="https://i.mcrpathways.org/wp-content/uploads/2025/11/Doc.pdf"></a></p>`;
    const { warnings } = htmlToPlate(html, assetMap);
    expect(warnings.some((w) => /filename fallback/i.test(w))).toBe(true);
  });
});

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

describe("htmlToPlate — internal cross-link rewriting", () => {
  it("rewrites i.mcrpathways.org links to /resources/article/<slug> when slug is in the migrated set", () => {
    const html = `<p>See <a href="https://i.mcrpathways.org/mentor-training/">Mentor Training</a> for details.</p>`;
    const { value } = htmlToPlate(html, undefined, {
      internalSlugs: new Set(["mentor-training", "group-work"]),
    });
    const para = value[0] as { type: string; children: unknown[] };
    const link = para.children.find(
      (c) => (c as { type?: string }).type === "a",
    ) as { type: string; url: string };
    expect(link).toBeDefined();
    expect(link.url).toBe("/resources/article/mentor-training");
  });

  it("leaves i.mcrpathways.org links unchanged when slug is NOT in the migrated set", () => {
    const html = `<p>See <a href="https://i.mcrpathways.org/cyber-security/">Cyber Security</a>.</p>`;
    const { value } = htmlToPlate(html, undefined, {
      internalSlugs: new Set(["mentor-training"]),
    });
    const para = value[0] as { children: { type?: string; url?: string }[] };
    const link = para.children.find((c) => c.type === "a") as { url: string };
    expect(link.url).toBe("https://i.mcrpathways.org/cyber-security/");
  });

  it("leaves links unchanged when no internalSlugs set is provided", () => {
    const html = `<p>See <a href="https://i.mcrpathways.org/mentor-training/">Mentor Training</a>.</p>`;
    const { value } = htmlToPlate(html);
    const para = value[0] as { children: { type?: string; url?: string }[] };
    const link = para.children.find((c) => c.type === "a") as { url: string };
    expect(link.url).toBe("https://i.mcrpathways.org/mentor-training/");
  });

  it("rewrites slug with no trailing slash", () => {
    const html = `<a href="https://i.mcrpathways.org/group-work">Group Work</a>`;
    const { value } = htmlToPlate(html, undefined, {
      internalSlugs: new Set(["group-work"]),
    });
    // The standalone <a> goes through buildLinkBlock fallback to a <p>-wrapped
    // inline link; check the inline anchor's url.
    const para = value[0] as { children: { type?: string; url?: string }[] };
    const link = para.children.find((c) => c.type === "a") as { url: string };
    expect(link.url).toBe("/resources/article/group-work");
  });

  it("normalises mixed-case path to lowercase before matching (Import HTML paste resilience)", () => {
    // The walker is shared with the Resources "Import HTML" UI feature.
    // A user pasting `https://i.mcrpathways.org/Mentor-Training/` should
    // still match the lowercase `mentor-training` slug in the set.
    const html = `<a href="https://i.mcrpathways.org/Mentor-Training/">Mentor Training</a>`;
    const { value } = htmlToPlate(html, undefined, {
      internalSlugs: new Set(["mentor-training"]),
    });
    const para = value[0] as { children: { type?: string; url?: string }[] };
    const link = para.children.find((c) => c.type === "a") as { url: string };
    expect(link.url).toBe("/resources/article/mentor-training");
  });

  it("does not match deeper paths like /mentor-training/sub-page/", () => {
    // Cautious behaviour: only top-level page slugs are rewritten. A deeper
    // path could be a sub-resource that doesn't map to an article.
    const html = `<a href="https://i.mcrpathways.org/mentor-training/sub-page/">Sub</a>`;
    const { value } = htmlToPlate(html, undefined, {
      internalSlugs: new Set(["mentor-training"]),
    });
    const para = value[0] as { children: { type?: string; url?: string }[] };
    const link = para.children.find((c) => c.type === "a") as { url: string };
    expect(link.url).toBe("https://i.mcrpathways.org/mentor-training/sub-page/");
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
