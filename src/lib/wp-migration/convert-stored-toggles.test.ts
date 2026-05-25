import { describe, it, expect } from "vitest";
import type { Value } from "platejs";
import { convertStoredToggles } from "./convert-stored-toggles";

describe("convertStoredToggles", () => {
  it("folds a flat toggle + indented body into a container", () => {
    const stored: Value = [
      { type: "h3", children: [{ text: "Email" }] },
      { type: "toggle", children: [{ text: "Accessing your work email" }] },
      { type: "p", indent: 1, children: [{ text: "Go to mail." }] } as never,
      { type: "h3", children: [{ text: "Calendar" }] },
    ];
    const { value, toggleCount } = convertStoredToggles(stored);
    expect(toggleCount).toBe(1);
    expect(value).toEqual([
      { type: "h3", children: [{ text: "Email" }] },
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
      { type: "h3", children: [{ text: "Calendar" }] },
    ]);
  });

  it("folds sibling toggles into separate containers, not nested", () => {
    const stored: Value = [
      { type: "h3", children: [{ text: "Section" }] },
      { type: "toggle", children: [{ text: "Step A" }] },
      { type: "p", indent: 1, children: [{ text: "Body A" }] } as never,
      { type: "toggle", children: [{ text: "Step B" }] },
      { type: "p", indent: 1, children: [{ text: "Body B" }] } as never,
    ];
    const { value, toggleCount } = convertStoredToggles(stored);
    expect(toggleCount).toBe(2);
    expect(value).toHaveLength(3);
    expect(value[1]).toEqual({
      type: "toggle_v2",
      children: [
        { type: "toggle_v2_summary", children: [{ text: "Step A" }] },
        { type: "p", children: [{ text: "Body A" }] },
      ],
    });
    expect(value[2]).toEqual({
      type: "toggle_v2",
      children: [
        { type: "toggle_v2_summary", children: [{ text: "Step B" }] },
        { type: "p", children: [{ text: "Body B" }] },
      ],
    });
  });

  it("keeps a deeper heading INSIDE the toggle body (parent-level scope)", () => {
    const stored: Value = [
      { type: "h3", children: [{ text: "Calendar" }] },
      {
        type: "toggle",
        children: [{ text: "Set notifications" }],
      },
      {
        type: "h4",
        indent: 1,
        children: [{ text: "Set preferences" }],
      } as never,
      { type: "p", indent: 1, children: [{ text: "Step 1" }] } as never,
    ];
    const { value } = convertStoredToggles(stored);
    expect(value[1]).toEqual({
      type: "toggle_v2",
      children: [
        { type: "toggle_v2_summary", children: [{ text: "Set notifications" }] },
        { type: "h4", children: [{ text: "Set preferences" }] },
        { type: "p", children: [{ text: "Step 1" }] },
      ],
    });
  });

  it("decrements indent on body list items rather than stripping (list items kept their walker indent)", () => {
    // A list item inside a toggle had indent: 2 in the legacy shape
    // (walkList gave it 1, indentToggleBodies +1 = 2). After conversion
    // it should be indent: 1 — the +1 post-pass contribution is removed
    // but the walker's own list indent is preserved.
    const stored: Value = [
      { type: "toggle", children: [{ text: "Steps" }] },
      {
        type: "p",
        indent: 2,
        listStyleType: "decimal",
        listStart: 1,
        children: [{ text: "First" }],
      } as never,
      {
        type: "p",
        indent: 2,
        listStyleType: "decimal",
        listStart: 2,
        children: [{ text: "Second" }],
      } as never,
    ];
    const { value } = convertStoredToggles(stored);
    expect(value).toHaveLength(1);
    const toggleChildren = (value[0] as { children: unknown[] }).children;
    expect(toggleChildren[1]).toEqual({
      type: "p",
      indent: 1,
      listStyleType: "decimal",
      listStart: 1,
      children: [{ text: "First" }],
    });
    expect(toggleChildren[2]).toEqual({
      type: "p",
      indent: 1,
      listStyleType: "decimal",
      listStart: 2,
      children: [{ text: "Second" }],
    });
  });

  it("closes the toggle on a heading at the surrounding parent level", () => {
    const stored: Value = [
      { type: "h3", children: [{ text: "Section A" }] },
      { type: "toggle", children: [{ text: "Step" }] },
      { type: "p", indent: 1, children: [{ text: "Body" }] } as never,
      { type: "h3", children: [{ text: "Section B" }] },
      { type: "p", children: [{ text: "After" }] },
    ];
    const { value } = convertStoredToggles(stored);
    expect(value[2]).toEqual({
      type: "h3",
      children: [{ text: "Section B" }],
    });
    expect(value[3]).toEqual({
      type: "p",
      children: [{ text: "After" }],
    });
  });

  it("closes a root-level toggle (no preceding heading) on any subsequent heading", () => {
    // Stored content where the article starts with a toggle, no heading
    // before it. `toggleParentLevel` is 0; the trailing heading should
    // close the toggle's scope instead of being swallowed into the body.
    const stored: Value = [
      { type: "toggle", children: [{ text: "Step" }] },
      { type: "p", indent: 1, children: [{ text: "Body" }] } as never,
      { type: "h2", children: [{ text: "After" }] },
      { type: "p", children: [{ text: "Outside" }] },
    ];
    const { value, toggleCount } = convertStoredToggles(stored);
    expect(toggleCount).toBe(1);
    expect(value).toEqual([
      {
        type: "toggle_v2",
        children: [
          { type: "toggle_v2_summary", children: [{ text: "Step" }] },
          { type: "p", children: [{ text: "Body" }] },
        ],
      },
      { type: "h2", children: [{ text: "After" }] },
      { type: "p", children: [{ text: "Outside" }] },
    ]);
  });

  it("returns toggleCount 0 and identical value when no toggles are present", () => {
    const stored: Value = [
      { type: "h2", children: [{ text: "Title" }] },
      { type: "p", children: [{ text: "Body" }] },
    ];
    const { value, toggleCount } = convertStoredToggles(stored);
    expect(toggleCount).toBe(0);
    expect(value).toEqual(stored);
  });
});
