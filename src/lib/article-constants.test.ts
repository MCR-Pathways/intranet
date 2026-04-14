import { describe, it, expect } from "vitest";
import {
  slugifyHeading,
  createSlugDeduplicator,
  ARTICLE_PROSE_CLASSES,
  ARTICLE_CONTENT_MODIFIERS,
  ARTICLE_CARD_CLASSES,
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

describe("shared constants", () => {
  it("ARTICLE_PROSE_CLASSES includes prose-sm and max-width", () => {
    expect(ARTICLE_PROSE_CLASSES).toContain("prose prose-sm");
    expect(ARTICLE_PROSE_CLASSES).toContain("max-w-[720px]");
  });

  it("ARTICLE_PROSE_CLASSES includes all content modifiers", () => {
    expect(ARTICLE_PROSE_CLASSES).toContain(ARTICLE_CONTENT_MODIFIERS);
  });

  it("ARTICLE_CONTENT_MODIFIERS does not include layout classes", () => {
    expect(ARTICLE_CONTENT_MODIFIERS).not.toContain("max-w-");
    expect(ARTICLE_CONTENT_MODIFIERS).not.toContain("flex-");
  });

  it("ARTICLE_CARD_CLASSES includes card styling", () => {
    expect(ARTICLE_CARD_CLASSES).toContain("bg-card");
    expect(ARTICLE_CARD_CLASSES).toContain("shadow-md");
    expect(ARTICLE_CARD_CLASSES).toContain("rounded-xl");
  });
});
