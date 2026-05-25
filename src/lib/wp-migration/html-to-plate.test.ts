/**
 * Walker tests. Each test isolates a specific structural transformation
 * driven by the design audit (memory/wp-migration-design-audit.md).
 * The walker is shared between the WP migration script and the Resources
 * "Import HTML" feature, so behaviour changes here affect both surfaces.
 */
import { describe, it, expect } from "vitest";
import { htmlToPlate } from "./html-to-plate";

describe("htmlToPlate — image-wrapped-in-link (clickable-image-preview pattern)", () => {
  it("keeps the image when it's the only surface for the file", () => {
    // Source: <a href="x.pdf"><img/></a> with NO other reference to x.pdf
    // in the document. The image-preview is the only surface; preserve it.
    const assetMap = new Map([
      [
        "https://i.mcrpathways.org/wp-content/uploads/2025/11/Doc.pdf",
        {
          fileId: "PDF_ID",
          mimeType: "application/pdf",
          fileName: "Doc.pdf",
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
    const html = `<a href="https://i.mcrpathways.org/wp-content/uploads/2025/11/Doc.pdf"><img src="https://i.mcrpathways.org/wp-content/uploads/2025/11/Screenshot.png" alt="Doc screenshot" /></a>`;
    const { value, warnings } = htmlToPlate(html, assetMap);
    const imgNode = value.find(
      (n) => (n as { type: string }).type === "img",
    ) as unknown as { type: string; url: string };
    expect(imgNode).toBeDefined();
    expect(imgNode.url).toBe("/api/drive-file/IMG_ID");
    const flatText = JSON.stringify(value);
    expect(flatText).not.toContain("Doc.pdf");
    expect(warnings).toEqual([]);
  });

  it("keeps multiple image previews when there's no text link (no data loss)", () => {
    // Edge case the textLinkHrefs design protects against: a page with
    // multiple image previews pointing at the same file but NO text-link
    // surface. A naive occurrence-count approach would drop all previews
    // (count > 1), orphaning the file. The textLinkHrefs set correctly
    // skips the dedupe path because no text-link surface exists.
    const assetMap = new Map([
      [
        "https://i.mcrpathways.org/wp-content/uploads/2025/11/Doc.pdf",
        {
          fileId: "PDF_ID",
          mimeType: "application/pdf",
          fileName: "Doc.pdf",
          size: 1000,
        },
      ],
      [
        "https://i.mcrpathways.org/wp-content/uploads/2025/11/Preview1.png",
        { fileId: "P1", mimeType: "image/png", fileName: "p1.png", size: 1 },
      ],
      [
        "https://i.mcrpathways.org/wp-content/uploads/2025/11/Preview2.png",
        { fileId: "P2", mimeType: "image/png", fileName: "p2.png", size: 1 },
      ],
    ]);
    const html = `<a href="https://i.mcrpathways.org/wp-content/uploads/2025/11/Doc.pdf"><img src="https://i.mcrpathways.org/wp-content/uploads/2025/11/Preview1.png" alt="Preview 1" /></a><a href="https://i.mcrpathways.org/wp-content/uploads/2025/11/Doc.pdf"><img src="https://i.mcrpathways.org/wp-content/uploads/2025/11/Preview2.png" alt="Preview 2" /></a>`;
    const { value, warnings } = htmlToPlate(html, assetMap);
    const imgNodes = value.filter((n) => (n as { type: string }).type === "img");
    expect(imgNodes).toHaveLength(2);
    expect((imgNodes[0] as unknown as { url: string }).url).toBe("/api/drive-file/P1");
    expect((imgNodes[1] as unknown as { url: string }).url).toBe("/api/drive-file/P2");
    expect(warnings.some((w) => /Dropped duplicate/i.test(w))).toBe(false);
  });

  it("drops the image-preview anchor when the same href appears as a text link elsewhere (dedupe)", () => {
    // WP pattern: <a href="x.pdf"><img/></a> AND <ul><li><a href="x.pdf">Label</a></li></ul>
    // Two surfaces for the same file — the visual preview duplicates the
    // text link. Drop the preview; the text link carries the click action.
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
    const html = `<a href="https://i.mcrpathways.org/wp-content/uploads/2025/11/Welcome-Pack.pdf"><img src="https://i.mcrpathways.org/wp-content/uploads/2025/11/Screenshot.png" alt="Screenshot" /></a><ul><li><a href="https://i.mcrpathways.org/wp-content/uploads/2025/11/Welcome-Pack.pdf">Welcome Pack</a></li></ul>`;
    const { value, warnings } = htmlToPlate(html, assetMap);
    // No image node should be emitted — the preview was redundant.
    const imgNodes = value.filter((n) => (n as { type: string }).type === "img");
    expect(imgNodes).toHaveLength(0);
    // The bullet-list link with "Welcome Pack" label should remain.
    const flatText = JSON.stringify(value);
    expect(flatText).toContain("Welcome Pack");
    expect(flatText).not.toContain("Welcome-Pack.pdf"); // no filename fallback
    // Walker should warn that it dropped the preview.
    expect(warnings.some((w) => /duplicate image-preview/i.test(w))).toBe(true);
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

  it("emits <a tabindex='0'> (Elementor accordion title) as a container-shape toggle_v2 with body children", () => {
    // WP source pattern from information-for-new-staff:
    // <h3>Setting Up My Email</h3>
    // <a tabindex="0">Accessing your work email</a>
    // <p>Go to mail.</p>
    // <a tabindex="0">Creating your email footer</a>
    // <p>Step 1</p>
    // <h3>Using Google Calendar</h3>
    // Each `<a tabindex="0">` opens a toggle. Walker emits a flat marker
    // `{type: "toggle"}` followed by body siblings; groupToggleBodies then
    // folds them into a container-shape toggle_v2 whose children are the
    // toggle_v2_summary (title) plus the body blocks.
    const html = `<h3>Setting Up My Email</h3><a tabindex="0">Accessing your work email</a><p>Go to mail.</p><a tabindex="0">Creating your email footer</a><p>Step 1</p><h3>Using Google Calendar</h3><p>After calendar.</p>`;
    const { value } = htmlToPlate(html);
    expect(value).toEqual([
      { type: "h3", children: [{ text: "Setting Up My Email" }] },
      {
        type: "toggle_v2",
        children: [
          {
            type: "toggle_v2_summary",
            children: [{ text: "Accessing your work email" }],
          },
          { type: "p", children: [{ text: "Go to mail." }] },
        ],
      },
      {
        type: "toggle_v2",
        children: [
          {
            type: "toggle_v2_summary",
            children: [{ text: "Creating your email footer" }],
          },
          { type: "p", children: [{ text: "Step 1" }] },
        ],
      },
      { type: "h3", children: [{ text: "Using Google Calendar" }] },
      { type: "p", children: [{ text: "After calendar." }] },
    ]);
  });

  it("keeps a deeper heading INSIDE the toggle body (parent-level scope)", () => {
    // Verified pattern on information-for-new-staff: an H4 nested inside
    // an Elementor toggle's .elementor-tab-content. Walker must NOT close
    // the toggle scope at the H4 because it's deeper than the parent H3.
    // The H4 lands as a child of toggle_v2 instead of indent-bumping
    // alongside.
    const html = `<h3>Using Google Calendar</h3><a tabindex="0">Set your Calendar event notifications</a><h4>Set preferences for all your calendars</h4><p>Step 1</p><a tabindex="0">Set your work hours</a><p>WH step</p>`;
    const { value } = htmlToPlate(html);
    expect(value).toEqual([
      { type: "h3", children: [{ text: "Using Google Calendar" }] },
      {
        type: "toggle_v2",
        children: [
          {
            type: "toggle_v2_summary",
            children: [{ text: "Set your Calendar event notifications" }],
          },
          {
            type: "h4",
            children: [{ text: "Set preferences for all your calendars" }],
          },
          { type: "p", children: [{ text: "Step 1" }] },
        ],
      },
      {
        type: "toggle_v2",
        children: [
          {
            type: "toggle_v2_summary",
            children: [{ text: "Set your work hours" }],
          },
          { type: "p", children: [{ text: "WH step" }] },
        ],
      },
    ]);
  });

  it("folds a toggle marker nested inside a blockquote into a toggle_v2 container", () => {
    // Defensive: real WP Elementor content never nests `<a tabindex>` inside
    // a blockquote (verified — 0 nested toggle markers across 9 native
    // articles in prod), but the walker's blockquote branch recurses with a
    // fresh `out` array (html-to-plate.ts:428-442), so a malformed source
    // CAN land a marker inside a blockquote's children. groupToggleBodies
    // walks container children recursively so the marker still folds.
    const html = `<blockquote><a tabindex="0">Inside blockquote</a></blockquote>`;
    const { value } = htmlToPlate(html);
    expect(value).toHaveLength(1);
    expect(value[0]).toMatchObject({ type: "blockquote" });
    const blockquoteChildren = (value[0] as { children: unknown[] }).children;
    expect(blockquoteChildren).toHaveLength(1);
    expect(blockquoteChildren[0]).toEqual({
      type: "toggle_v2",
      children: [
        {
          type: "toggle_v2_summary",
          children: [{ text: "Inside blockquote" }],
        },
      ],
    });
  });

  it("closes a root-level toggle (no preceding heading) on any subsequent heading", () => {
    // Walker input where the article opens with `<a tabindex>` and no
    // preceding heading. `toggleParentLevel` is 0; the trailing H2 should
    // close the toggle's body rather than being swallowed into it.
    const html = `<a tabindex="0">Root toggle</a><p>Body</p><h2>After</h2><p>Outside</p>`;
    const { value } = htmlToPlate(html);
    expect(value).toEqual([
      {
        type: "toggle_v2",
        children: [
          { type: "toggle_v2_summary", children: [{ text: "Root toggle" }] },
          { type: "p", children: [{ text: "Body" }] },
        ],
      },
      { type: "h2", children: [{ text: "After" }] },
      { type: "p", children: [{ text: "Outside" }] },
    ]);
  });

  it("subsequent sibling toggle inherits an in-body sub-heading's level as its parent", () => {
    // Mirrors legacy `indentToggleBodies` semantics. After a toggle whose
    // body contains an H4, the outer `mostRecentHeadingLevel` tracker bumps
    // to 4; the next sibling toggle gets `parent: 4` (not the original H3
    // level), so a trailing H4 closes the sibling toggle rather than
    // landing in its body.
    const html = `<h3>Section</h3><a tabindex="0">Step A</a><h4>Sub-step</h4><a tabindex="0">Step B</a><h4>Next section</h4><p>After.</p>`;
    const { value } = htmlToPlate(html);
    expect(value).toEqual([
      { type: "h3", children: [{ text: "Section" }] },
      {
        type: "toggle_v2",
        children: [
          { type: "toggle_v2_summary", children: [{ text: "Step A" }] },
          { type: "h4", children: [{ text: "Sub-step" }] },
        ],
      },
      {
        type: "toggle_v2",
        children: [
          { type: "toggle_v2_summary", children: [{ text: "Step B" }] },
        ],
      },
      { type: "h4", children: [{ text: "Next section" }] },
      { type: "p", children: [{ text: "After." }] },
    ]);
  });

  it("closes the toggle on a heading at the parent level (next section)", () => {
    // H3 "Using Google Calendar" opens a section. Toggles inside that
    // section have parent level 3. A subsequent H3 closes any open toggle
    // because it's a new section at the same level as the parent — the H3
    // lands as a sibling of the toggle, not as a body child.
    const html = `<h3>Using Google Calendar</h3><a tabindex="0">Step A</a><p>Body A</p><h3>Using Google Meet</h3><p>Meet content.</p>`;
    const { value } = htmlToPlate(html);
    expect(value).toEqual([
      { type: "h3", children: [{ text: "Using Google Calendar" }] },
      {
        type: "toggle_v2",
        children: [
          { type: "toggle_v2_summary", children: [{ text: "Step A" }] },
          { type: "p", children: [{ text: "Body A" }] },
        ],
      },
      { type: "h3", children: [{ text: "Using Google Meet" }] },
      { type: "p", children: [{ text: "Meet content." }] },
    ]);
  });

  it("emits list items inside a toggle as children of toggle_v2", () => {
    // A numbered list inside a toggle keeps its walker-assigned indent
    // (no post-pass +1 indent bump because the container shape relies on
    // structural nesting, not indent, for scope). List numbering still
    // increments via listStart.
    const html = `<a tabindex="0">Steps</a><ol><li>First</li><li>Second</li></ol>`;
    const { value } = htmlToPlate(html);
    expect(value).toHaveLength(1);
    expect(value[0]).toMatchObject({ type: "toggle_v2" });
    const toggleChildren = (value[0] as { children: unknown[] }).children;
    expect(toggleChildren).toHaveLength(3);
    expect(toggleChildren[0]).toEqual({
      type: "toggle_v2_summary",
      children: [{ text: "Steps" }],
    });
    expect(toggleChildren[1]).toMatchObject({
      type: "p",
      indent: 1,
      listStyleType: "decimal",
      listStart: 1,
    });
    expect(toggleChildren[2]).toMatchObject({
      type: "p",
      indent: 1,
      listStyleType: "decimal",
      listStart: 2,
    });
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

describe("htmlToPlate — ordered list numbering (listStart)", () => {
  it("emits sequential listStart values across a flat <ol>", () => {
    // Plate's BaseListPlugin wraps each list-styled paragraph in its OWN
    // <ol>, using listStart as the <ol start="N"> attribute. Without it,
    // every item visually reads "1." — the bug surfaced on new-staff-info.
    const html = `<ol><li>Alpha</li><li>Bravo</li><li>Charlie</li><li>Delta</li></ol>`;
    const { value } = htmlToPlate(html);
    expect(value).toHaveLength(4);
    expect(value[0]).toMatchObject({ type: "p", listStyleType: "decimal", listStart: 1 });
    expect(value[1]).toMatchObject({ type: "p", listStyleType: "decimal", listStart: 2 });
    expect(value[2]).toMatchObject({ type: "p", listStyleType: "decimal", listStart: 3 });
    expect(value[3]).toMatchObject({ type: "p", listStyleType: "decimal", listStart: 4 });
  });

  it("respects <ol start='N'> as the base index", () => {
    const html = `<ol start="5"><li>Five</li><li>Six</li></ol>`;
    const { value } = htmlToPlate(html);
    expect(value[0]).toMatchObject({ listStart: 5 });
    expect(value[1]).toMatchObject({ listStart: 6 });
  });

  it("restarts the counter inside a nested <ol>", () => {
    // Nested ordered lists in HTML start at 1, independent of the outer list.
    const html = `<ol><li>Outer one<ol><li>Inner one</li><li>Inner two</li></ol></li><li>Outer two</li></ol>`;
    const { value } = htmlToPlate(html);
    // value[0] = "Outer one" (listStart 1)
    // value[1] = "Inner one" (listStart 1, deeper indent)
    // value[2] = "Inner two" (listStart 2)
    // value[3] = "Outer two" (listStart 2)
    expect(value[0]).toMatchObject({ listStart: 1, indent: 1 });
    expect(value[1]).toMatchObject({ listStart: 1, indent: 2 });
    expect(value[2]).toMatchObject({ listStart: 2, indent: 2 });
    expect(value[3]).toMatchObject({ listStart: 2, indent: 1 });
  });

  it("does NOT emit listStart on unordered lists (the <start> attribute is <ol>-only)", () => {
    const html = `<ul><li>Alpha</li><li>Bravo</li></ul>`;
    const { value } = htmlToPlate(html);
    expect(value[0]).toMatchObject({ type: "p", listStyleType: "disc" });
    expect(value[0]).not.toHaveProperty("listStart");
    expect(value[1]).not.toHaveProperty("listStart");
  });
});
