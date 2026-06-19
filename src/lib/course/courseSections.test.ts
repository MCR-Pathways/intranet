import { describe, it, expect } from "vitest";
import { groupIntoSections } from "@/lib/course/courseSections";
import type {
  ContentItemWithOptions,
  ContentItemType,
} from "@/types/chat-content";

/** Minimal content-item fixture builder. */
function item(
  id: string,
  type: ContentItemType,
  sort_order: number,
  overrides: Partial<ContentItemWithOptions> = {}
): ContentItemWithOptions {
  return {
    id,
    collection_id: "col-1",
    parent_id: null,
    type,
    title: null,
    content: null,
    is_required: false,
    correct_answer: null,
    settings: {},
    sort_order,
    options: [],
    ...overrides,
  };
}

describe("groupIntoSections", () => {
  it("groups items under their preceding section_header in sort order", () => {
    const items = [
      item("h1", "section_header", 0, { settings: { layout: "content" } }),
      item("a", "text", 1),
      item("b", "video", 2),
      item("h2", "section_header", 3, { settings: { layout: "quiz" } }),
      item("c", "multiple_choice", 4),
    ];

    const sections = groupIntoSections(items);

    expect(sections).toHaveLength(2);
    expect(sections[0].header.id).toBe("h1");
    expect(sections[0].layout).toBe("content");
    expect(sections[0].blocks.map((b) => b.id)).toEqual(["a", "b"]);
    expect(sections[1].header.id).toBe("h2");
    expect(sections[1].layout).toBe("quiz");
    expect(sections[1].blocks.map((b) => b.id)).toEqual(["c"]);
  });

  it("sorts an out-of-order input by sort_order before grouping", () => {
    const items = [
      item("c", "multiple_choice", 4),
      item("h1", "section_header", 0, { settings: { layout: "content" } }),
      item("h2", "section_header", 3, { settings: { layout: "quiz" } }),
      item("a", "text", 1),
      item("b", "video", 2),
    ];

    const sections = groupIntoSections(items);

    expect(sections.map((s) => s.header.id)).toEqual(["h1", "h2"]);
    expect(sections[0].blocks.map((b) => b.id)).toEqual(["a", "b"]);
    expect(sections[1].blocks.map((b) => b.id)).toEqual(["c"]);
  });

  it("defaults a header with no layout setting to 'content'", () => {
    const items = [
      item("h1", "section_header", 0),
      item("a", "text", 1),
    ];

    const sections = groupIntoSections(items);

    expect(sections[0].layout).toBe("content");
  });

  it("keeps orphan items that precede the first header by prepending them to the first section", () => {
    const items = [
      item("orphan1", "text", 0),
      item("orphan2", "image", 1),
      item("h1", "section_header", 2, { settings: { layout: "content" } }),
      item("a", "text", 3),
    ];

    const sections = groupIntoSections(items);

    expect(sections).toHaveLength(1);
    // Orphans are not dropped: they sit at the front of the first section.
    expect(sections[0].blocks.map((b) => b.id)).toEqual([
      "orphan1",
      "orphan2",
      "a",
    ]);
  });

  it("wraps a header-less course in a single synthetic content section without dropping items", () => {
    const items = [
      item("a", "text", 0),
      item("b", "video", 1),
    ];

    const sections = groupIntoSections(items);

    expect(sections).toHaveLength(1);
    expect(sections[0].layout).toBe("content");
    expect(sections[0].header.type).toBe("section_header");
    expect(sections[0].blocks.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("returns a single synthetic section with no blocks for an empty item list", () => {
    const sections = groupIntoSections([]);

    expect(sections).toHaveLength(1);
    expect(sections[0].blocks).toEqual([]);
  });
});
