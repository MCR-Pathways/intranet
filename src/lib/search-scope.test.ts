import { describe, it, expect } from "vitest";
import { filterResultsByScope, type SearchResults } from "@/lib/search-scope";

// Minimal fixtures — the helper only cares about array membership, not hit shape.
const results = {
  resources: [{ objectID: "r1" }],
  courses: [{ objectID: "c1" }],
  news: [{ objectID: "n1" }],
} as unknown as SearchResults;

describe("filterResultsByScope", () => {
  it("returns the input unchanged for 'all'", () => {
    expect(filterResultsByScope(results, "all")).toBe(results);
  });

  it("keeps only resources for 'resources'", () => {
    const r = filterResultsByScope(results, "resources");
    expect(r.resources).toHaveLength(1);
    expect(r.courses).toHaveLength(0);
    expect(r.news).toHaveLength(0);
  });

  it("keeps only courses for 'courses'", () => {
    const r = filterResultsByScope(results, "courses");
    expect(r.courses).toHaveLength(1);
    expect(r.resources).toHaveLength(0);
    expect(r.news).toHaveLength(0);
  });

  it("keeps only news for 'news'", () => {
    const r = filterResultsByScope(results, "news");
    expect(r.news).toHaveLength(1);
    expect(r.resources).toHaveLength(0);
    expect(r.courses).toHaveLength(0);
  });
});
