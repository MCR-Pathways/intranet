import { describe, it, expect } from "vitest";
import {
  slugifyHeading,
  createSlugDeduplicator,
  filterRailHeadings,
  ARTICLE_PROSE_CLASSES,
  ARTICLE_CONTENT_MODIFIERS,
  ARTICLE_CARD_CLASSES,
  type ArticleHeading,
} from "./article-constants";

describe("slugifyHeading", () => {
  it("converts heading text to a URL-safe slug", () => {
    expect(slugifyHeading("Getting Started")).toBe("getting-started");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugifyHeading("--hello--")).toBe("hello");
  });

  it("collapses consecutive special characters", () => {
    expect(slugifyHeading("How to: set up & configure")).toBe(
      "how-to-set-up-configure"
    );
  });

  it("handles numbers", () => {
    expect(slugifyHeading("Step 1: Introduction")).toBe("step-1-introduction");
  });

  it("returns empty string for non-alphanumeric input", () => {
    expect(slugifyHeading("!!!")).toBe("");
  });
});

describe("createSlugDeduplicator", () => {
  it("returns the base slug on first occurrence", () => {
    const deduplicate = createSlugDeduplicator();
    expect(deduplicate("Introduction")).toBe("introduction");
  });

  it("appends -1 on second occurrence (Google Doc scheme)", () => {
    const deduplicate = createSlugDeduplicator();
    deduplicate("FAQ");
    expect(deduplicate("FAQ")).toBe("faq-1");
  });

  it("appends -2 on third occurrence", () => {
    const deduplicate = createSlugDeduplicator();
    deduplicate("Section");
    deduplicate("Section");
    expect(deduplicate("Section")).toBe("section-2");
  });

  it("tracks different slugs independently", () => {
    const deduplicate = createSlugDeduplicator();
    expect(deduplicate("Alpha")).toBe("alpha");
    expect(deduplicate("Beta")).toBe("beta");
    expect(deduplicate("Alpha")).toBe("alpha-1");
    expect(deduplicate("Beta")).toBe("beta-1");
  });
});

describe("filterRailHeadings", () => {
  const h = (level: number, text: string): ArticleHeading => ({
    level,
    text,
    slug: text.toLowerCase().replace(/\s+/g, "-"),
  });

  it("keeps H2 and H3 on well-formed content, dropping H4+", () => {
    const input = [h(2, "Section"), h(3, "Sub"), h(4, "Detail"), h(3, "Sub 2")];
    expect(filterRailHeadings(input).map((x) => x.text)).toEqual([
      "Section",
      "Sub",
      "Sub 2",
    ]);
  });

  it("rails H1 + H2 for an H1-sectioned document (synced Google Docs)", () => {
    const input = [h(1, "Intro"), h(2, "Detail"), h(1, "Policy"), h(3, "Deep")];
    expect(filterRailHeadings(input).map((x) => x.text)).toEqual([
      "Intro",
      "Detail",
      "Policy",
    ]);
  });

  it("rails H2 + H4 when a document skips H3", () => {
    const input = [h(2, "Section"), h(4, "Sub"), h(4, "Sub 2")];
    expect(filterRailHeadings(input).map((x) => x.text)).toEqual([
      "Section",
      "Sub",
      "Sub 2",
    ]);
  });

  it("keeps a single-level document intact", () => {
    const input = [h(2, "A"), h(2, "B"), h(2, "C")];
    expect(filterRailHeadings(input).map((x) => x.text)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("preserves document order", () => {
    const input = [h(2, "A"), h(3, "B"), h(2, "C"), h(3, "D")];
    expect(filterRailHeadings(input).map((x) => x.text)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  it("returns [] for empty input", () => {
    expect(filterRailHeadings([])).toEqual([]);
  });
});

describe("shared constants", () => {
  it("ARTICLE_PROSE_CLASSES caps the column at the 90ch reading measure (§4)", () => {
    expect(ARTICLE_PROSE_CLASSES).toContain("prose prose-sm");
    // One measure for everything: text, grids and tables cap together.
    // 90ch beats prose's built-in 65ch default and replaces the old 720px cap.
    expect(ARTICLE_PROSE_CLASSES).toContain("max-w-[90ch]");
    expect(ARTICLE_PROSE_CLASSES).not.toContain("max-w-none");
  });

  it("ARTICLE_PROSE_CLASSES includes all content modifiers", () => {
    expect(ARTICLE_PROSE_CLASSES).toContain(ARTICLE_CONTENT_MODIFIERS);
  });

  it("ARTICLE_CONTENT_MODIFIERS does not include layout classes", () => {
    expect(ARTICLE_CONTENT_MODIFIERS).not.toContain("max-w-");
    expect(ARTICLE_CONTENT_MODIFIERS).not.toContain("flex-");
  });

  it("ARTICLE_CARD_CLASSES matches the canonical card wrapper", () => {
    expect(ARTICLE_CARD_CLASSES).toContain("bg-card");
    expect(ARTICLE_CARD_CLASSES).toContain("border border-border");
    expect(ARTICLE_CARD_CLASSES).toContain("rounded-xl");
    expect(ARTICLE_CARD_CLASSES).toContain("shadow-sm");
  });

  it("ARTICLE_CARD_CLASSES drops the heavy shadow (soft-retreat shape)", () => {
    expect(ARTICLE_CARD_CLASSES).not.toContain("shadow-md");
  });
});
