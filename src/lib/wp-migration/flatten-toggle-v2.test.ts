import { describe, expect, it } from "vitest";
import type { Value } from "platejs";
import { flattenToggleV2 } from "./flatten-toggle-v2";

function p(text: string, opts?: { withLink?: boolean }): Record<string, unknown> {
  if (opts?.withLink) {
    return {
      type: "p",
      children: [
        {
          type: "a",
          url: "https://example.com",
          children: [{ text }],
        },
      ],
    };
  }
  return { type: "p", children: [{ text }] };
}

function heading(level: string, text: string) {
  return { type: level, children: [{ text }] };
}

function toggle(summary: string, body: unknown[]) {
  return {
    type: "toggle_v2",
    children: [
      {
        type: "toggle_v2_summary",
        children: [{ text: summary }],
      },
      ...body,
    ],
  };
}

describe("flattenToggleV2 — basic flatten", () => {
  it("promotes a toggle summary to h3 and inlines body as siblings", () => {
    const input = [
      heading("h2", "Section"),
      toggle("Step One", [p("Do the thing")]),
    ] as unknown as Value;

    const result = flattenToggleV2(input);

    expect(result.flattenedCount).toBe(1);
    expect(result.labelPromotionCount).toBe(0);
    expect(result.value).toEqual([
      heading("h2", "Section"),
      heading("h3", "Step One"),
      p("Do the thing"),
    ]);
  });

  it("uses a custom summaryHeadingLevel when given", () => {
    const input = [toggle("Only Toggle", [p("body")])] as unknown as Value;
    const result = flattenToggleV2(input, { summaryHeadingLevel: "h2" });
    expect(result.value[0]).toEqual(heading("h2", "Only Toggle"));
  });

  it("demotes nested headings inside the toggle body by one level", () => {
    const input = [
      toggle("Outer", [p("intro"), heading("h3", "Inner heading"), p("after")]),
    ] as unknown as Value;

    const result = flattenToggleV2(input);

    expect(result.demotionCount).toBe(1);
    expect(result.value).toEqual([
      heading("h3", "Outer"),
      p("intro"),
      heading("h4", "Inner heading"),
      p("after"),
    ]);
  });

  it("excludes toggles whose summary text matches the exclude list (case-insensitive)", () => {
    const input = [
      toggle("Keep Me Open", [p("body 1")]),
      toggle("Flatten Me", [p("body 2")]),
    ] as unknown as Value;

    const result = flattenToggleV2(input, { exclude: ["KEEP ME open"] });

    expect(result.skippedCount).toBe(1);
    expect(result.flattenedCount).toBe(1);
    // First toggle stays intact; second is flattened
    expect((result.value[0] as { type?: string }).type).toBe("toggle_v2");
    expect(result.value[1]).toEqual(heading("h3", "Flatten Me"));
  });

  it("recursively flattens nested toggles inside a flattened toggle body", () => {
    const input = [
      toggle("Outer", [
        p("outer body"),
        toggle("Inner", [p("inner body")]),
      ]),
    ] as unknown as Value;

    const result = flattenToggleV2(input);

    expect(result.flattenedCount).toBe(2);
    expect(result.value).toEqual([
      heading("h3", "Outer"),
      p("outer body"),
      heading("h4", "Inner"),
      p("inner body"),
    ]);
  });

  it("leaves non-toggle nodes untouched", () => {
    const input = [
      heading("h2", "Heading"),
      p("paragraph"),
    ] as unknown as Value;

    const result = flattenToggleV2(input);

    expect(result.flattenedCount).toBe(0);
    expect(result.value).toEqual(input);
  });
});

describe("flattenToggleV2 — promoteParagraphLabels", () => {
  it("promotes label-only paragraphs but leaves link paragraphs with same text intact", () => {
    const input = [
      toggle("Mentoring", [
        p("Mentoring Activity Plans"),
        p("Mentoring Activity Plans", { withLink: true }),
        p("Mentoring Resources"),
        p("Activity 4, Resource 1 - Gingerbread Person", { withLink: true }),
      ]),
    ] as unknown as Value;

    const result = flattenToggleV2(input, {
      promoteParagraphLabels: {
        suffixes: ["Activity Plans", "Resources"],
      },
    });

    expect(result.flattenedCount).toBe(1);
    expect(result.labelPromotionCount).toBe(2);
    expect(result.value).toEqual([
      heading("h3", "Mentoring"),
      heading("h4", "Mentoring Activity Plans"),
      p("Mentoring Activity Plans", { withLink: true }),
      heading("h4", "Mentoring Resources"),
      p("Activity 4, Resource 1 - Gingerbread Person", { withLink: true }),
    ]);
  });

  it("matches labels case-insensitively against the summary text", () => {
    // Real case from group-work: summary "Getting to know you" (lowercase
    // t/k/y), label "Getting to Know You Activity Plans" (Title Case)
    const input = [
      toggle("Getting to know you", [
        p("Getting to Know You Activity Plans"),
        p("Getting to Know You Activity Plans", { withLink: true }),
        p("Getting to Know You Resources"),
      ]),
    ] as unknown as Value;

    const result = flattenToggleV2(input, {
      promoteParagraphLabels: {
        suffixes: ["Activity Plans", "Resources"],
      },
    });

    expect(result.labelPromotionCount).toBe(2);
    const types = result.value.map((n) => (n as { type?: string }).type);
    expect(types).toEqual(["h3", "h4", "p", "h4"]);
  });

  it("uses a custom level for promoted labels", () => {
    const input = [
      toggle("Theme", [p("Theme Activity Plans")]),
    ] as unknown as Value;

    const result = flattenToggleV2(input, {
      summaryHeadingLevel: "h2",
      promoteParagraphLabels: {
        suffixes: ["Activity Plans"],
        level: "h3",
      },
    });

    expect(result.value).toEqual([
      heading("h2", "Theme"),
      heading("h3", "Theme Activity Plans"),
    ]);
  });

  it("does not promote paragraphs whose text doesn't match the suffix pattern", () => {
    const input = [
      toggle("Theme", [
        p("Theme Activity Plans"), // matches
        p("Some other heading"), // does not match
        p("Theme Footer"), // does not match (Footer not in suffixes)
      ]),
    ] as unknown as Value;

    const result = flattenToggleV2(input, {
      promoteParagraphLabels: {
        suffixes: ["Activity Plans", "Resources"],
      },
    });

    expect(result.labelPromotionCount).toBe(1);
  });

  it("returns labelPromotionCount=0 when promoteParagraphLabels is not provided", () => {
    const input = [
      toggle("Theme", [p("Theme Activity Plans")]),
    ] as unknown as Value;

    const result = flattenToggleV2(input);

    expect(result.labelPromotionCount).toBe(0);
    // The would-be-label paragraph stays as p
    expect((result.value[1] as { type?: string }).type).toBe("p");
  });

  it("matches labels with non-breaking spaces and runs of spaces collapsed to one space", () => {
    // WP HTML often serialises a tight word boundary as &nbsp; (U+00A0)
    // and can drop extra whitespace between tokens. The matcher should
    // treat those as equivalent to a single regular space.
    const input = [
      toggle("Theme Name", [
        p("theme  name Activity\tPlans"),
        p("ThemeName Resources"),
      ]),
    ] as unknown as Value;

    const result = flattenToggleV2(input, {
      promoteParagraphLabels: {
        suffixes: ["Activity Plans", "Resources"],
      },
    });

    // First paragraph matches "theme name activity plans" once collapsed.
    // Second paragraph "ThemeName Resources" does NOT match because the
    // summary normalises to "theme name" — collapsing whitespace doesn't
    // merge previously-distinct tokens, only flattens runs of whitespace.
    expect(result.labelPromotionCount).toBe(1);
  });

  it("matches labels with a non-breaking space in the source text", () => {
    // WP HTML often serialises a tight word boundary as &nbsp; (U+00A0).
    // After whitespace normalisation the nbsp is equivalent to a regular
    // space, so the label still matches.
    const NBSP = " ";
    const input = [
      toggle(`Theme${NBSP}Name`, [
        p(`Theme${NBSP}Name${NBSP}Activity${NBSP}Plans`),
      ]),
    ] as unknown as Value;

    const result = flattenToggleV2(input, {
      promoteParagraphLabels: {
        suffixes: ["Activity Plans"],
      },
    });

    expect(result.labelPromotionCount).toBe(1);
  });
});
