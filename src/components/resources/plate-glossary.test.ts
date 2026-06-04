import { describe, it, expect } from "vitest";
import { createSlateEditor } from "platejs";
import {
  BaseGlossaryPlugin,
  BaseGlossaryEntryPlugin,
  BaseGlossaryTermPlugin,
  BaseGlossaryDefinitionPlugin,
} from "./plate-glossary";

function makeEditor(value: unknown) {
  return createSlateEditor({
    plugins: [
      BaseGlossaryPlugin,
      BaseGlossaryEntryPlugin,
      BaseGlossaryTermPlugin,
      BaseGlossaryDefinitionPlugin,
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: value as any,
  });
}

const entry = (term: string, def: string) => ({
  type: "glossary_entry",
  children: [
    { type: "glossary_term", children: [{ text: term }] },
    { type: "glossary_definition", children: [{ text: def }] },
  ],
});

describe("glossary normalizeNode", () => {
  it("backfills a missing definition slot", () => {
    const editor = makeEditor([
      {
        type: "glossary",
        children: [
          {
            type: "glossary_entry",
            children: [{ type: "glossary_term", children: [{ text: "Advocate" }] }],
          },
        ],
      },
    ]);
    editor.tf.normalize({ force: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = (editor.children[0] as any).children[0];
    expect(e.children).toHaveLength(2);
    expect(e.children[0].type).toBe("glossary_term");
    expect(e.children[1].type).toBe("glossary_definition");
  });

  it("backfills an entry into an empty glossary", () => {
    const editor = makeEditor([{ type: "glossary", children: [] }]);
    editor.tf.normalize({ force: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = editor.children[0] as any;
    expect(g.children).toHaveLength(1);
    expect(g.children[0].type).toBe("glossary_entry");
    expect(g.children[0].children[0].type).toBe("glossary_term");
  });

  it("lifts a glossary nested inside another glossary out to the top level", () => {
    // The bug Colin caught: inserting a glossary while the cursor sat inside
    // one nested a glossary in a glossary. The normaliser must un-nest it.
    const editor = makeEditor([
      {
        type: "glossary",
        children: [
          entry("First", "First def"),
          { type: "glossary", children: [entry("Nested", "Nested def")] },
        ],
      },
    ]);
    editor.tf.normalize({ force: true });
    // Two top-level glossaries, neither nested inside the other.
    expect(editor.children).toHaveLength(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.children.forEach((n: any) => {
      expect(n.type).toBe("glossary");
      // every child of every glossary is an entry — no glossary-in-glossary
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      n.children.forEach((c: any) => expect(c.type).toBe("glossary_entry"));
    });
  });
});

describe("glossary insertBreak", () => {
  it("Enter in a term jumps the cursor into the definition", () => {
    const editor = makeEditor([
      { type: "glossary", children: [entry("Advocate", "An advocate is…")] },
    ]);
    editor.tf.select({ path: [0, 0, 0, 0], offset: "Advocate".length });
    editor.tf.insertBreak();
    // selection should now sit inside the definition: [0,0,1,...]
    expect(editor.selection?.anchor.path.slice(0, 3)).toEqual([0, 0, 1]);
  });

  it("Enter in a definition creates a new entry below, cursor in its term", () => {
    const editor = makeEditor([
      { type: "glossary", children: [entry("Advocate", "An advocate is…")] },
    ]);
    editor.tf.select({ path: [0, 0, 1, 0], offset: "An advocate is…".length });
    editor.tf.insertBreak();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = editor.children[0] as any;
    expect(g.children).toHaveLength(2);
    expect(g.children[1].type).toBe("glossary_entry");
    // cursor in the new entry's term: [0,1,0,...]
    expect(editor.selection?.anchor.path.slice(0, 3)).toEqual([0, 1, 0]);
  });
});

describe("glossary deleteBackward", () => {
  it("Backspace at start of definition hops to term end — no merge", () => {
    const editor = makeEditor([
      { type: "glossary", children: [entry("Term", "Definition")] },
    ]);
    editor.tf.select({ path: [0, 0, 1, 0], offset: 0 });
    editor.tf.deleteBackward("character");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = (editor.children[0] as any).children[0];
    expect(e.children[1].children[0].text).toBe("Definition"); // unchanged
    // cursor at end of the term
    expect(editor.selection?.anchor.path.slice(0, 3)).toEqual([0, 0, 0]);
    expect(editor.selection?.anchor.offset).toBe("Term".length);
  });

  it("Backspace in an empty non-first entry removes that entry", () => {
    const editor = makeEditor([
      {
        type: "glossary",
        children: [entry("First", "First def"), entry("", "")],
      },
    ]);
    editor.tf.select({ path: [0, 1, 0, 0], offset: 0 });
    editor.tf.deleteBackward("character");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = editor.children[0] as any;
    expect(g.children).toHaveLength(1);
    expect(g.children[0].children[0].children[0].text).toBe("First");
  });

  it("Backspace at start of a non-empty non-first term hops to previous definition end — no merge", () => {
    const editor = makeEditor([
      {
        type: "glossary",
        children: [entry("First", "First def"), entry("Second", "Second def")],
      },
    ]);
    editor.tf.select({ path: [0, 1, 0, 0], offset: 0 });
    editor.tf.deleteBackward("character");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = editor.children[0] as any;
    expect(g.children).toHaveLength(2); // both entries intact, nothing merged
    expect(editor.selection?.anchor.path.slice(0, 3)).toEqual([0, 0, 1]);
  });
});
