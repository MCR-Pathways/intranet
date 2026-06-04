"use client";

import {
  createSlatePlugin,
  NodeApi,
  PathApi,
  type TElement,
} from "platejs";

/**
 * Glossary block — a definition list of term + definition entries.
 *
 * JSON shape (structurally nested, one level deeper than toggle_v2):
 *
 *   { type: "glossary", variant: "terms" | "acronyms", children: [
 *       { type: "glossary_entry", children: [
 *           { type: "glossary_term", children: [{ text: "Advocate" }] },
 *           { type: "glossary_definition", children: [{ text: "An advocate is…" }] },
 *       ] },
 *       …more entries
 *   ] }
 *
 * Renders two ways via the dual static-component maps (see
 * plate-static-plugins.tsx):
 *   - browser  → <dl> / <div class="glossary-entry"> / <dt> / <dd>
 *   - Algolia  → bare fragments that collapse to a flat <h4> + <p> run, so
 *     parseHtmlIntoSections indexes one section per term for free.
 *
 * Three transforms keep the structure valid and the keyboard behaviour
 * Notion-like (the editing-perfectly bar):
 *
 *  1. normalizeNode — a glossary_entry is always [glossary_term,
 *     glossary_definition]; a glossary always holds ≥1 entry. Missing slots
 *     are backfilled rather than letting a delete corrupt the tree.
 *  2. insertBreak — Enter in a term jumps into its definition; Enter in a
 *     definition starts a new entry below (list-like authoring).
 *  3. deleteBackward — Backspace at the start of a term/definition never
 *     merges across the term/definition or entry boundary (which would
 *     destroy the structure); it repositions the cursor. Backspace in a
 *     fully-empty entry removes that entry.
 */

const GLOSSARY = "glossary";
const ENTRY = "glossary_entry";
const TERM = "glossary_term";
const DEF = "glossary_definition";

/** A fresh, empty term + definition pair. Exported for the editor elements
 *  (add-entry button) and the block-insert menu. */
export function createEmptyGlossaryEntry() {
  return {
    type: ENTRY,
    children: [
      { type: TERM, children: [{ text: "" }] },
      { type: DEF, children: [{ text: "" }] },
    ],
  };
}

const emptyEntry = createEmptyGlossaryEntry;

/** Both slots present and textually empty. */
function isEntryEmpty(entry: Record<string, unknown> | undefined): boolean {
  if (!entry) return false;
  const kids = (entry.children ?? []) as Record<string, unknown>[];
  const text = kids.map((k) => NodeApi.string(k as never)).join("");
  return text.trim() === "";
}

export const BaseGlossaryPlugin = createSlatePlugin({
  key: GLOSSARY,
  node: { isElement: true },
}).overrideEditor(
  ({ editor, tf: { normalizeNode, insertBreak, deleteBackward } }) => ({
    transforms: {
      normalizeNode(entry) {
        const [node, path] = entry;
        const record = node as Record<string, unknown>;
        const type = record.type;

        if (type === GLOSSARY) {
          const children = (record.children ?? []) as Record<string, unknown>[];
          // A glossary with no entries can't be edited (no cursor target) and
          // renders an empty <dl>. Backfill a starter entry.
          if (children.length === 0) {
            editor.tf.insertNodes(emptyEntry() as never, { at: [...path, 0] });
            return;
          }
          // A glossary holds ONLY entries. Anything else — most commonly a
          // glossary dropped inside this one (insert/paste while the cursor
          // sat in an entry) — gets lifted out to sit as a sibling block,
          // never a glossary nested in a glossary.
          for (let i = 0; i < children.length; i++) {
            if (children[i]?.type !== ENTRY) {
              editor.tf.liftNodes({ at: [...path, i] });
              return;
            }
          }
        }

        if (type === ENTRY) {
          const children = (record.children ?? []) as Record<string, unknown>[];
          // Slot 0 must be the term.
          if (children.length === 0 || children[0]?.type !== TERM) {
            editor.tf.insertNodes(
              { type: TERM, children: [{ text: "" }] } as never,
              { at: [...path, 0] },
            );
            return;
          }
          // Slot 1 must be the definition.
          if (children.length < 2 || children[1]?.type !== DEF) {
            editor.tf.insertNodes(
              { type: DEF, children: [{ text: "" }] } as never,
              { at: [...path, 1] },
            );
            return;
          }
        }

        normalizeNode(entry);
      },

      insertBreak() {
        const blockEntry = editor.api.block();
        if (!blockEntry) return insertBreak();
        const [block, blockPath] = blockEntry as [TElement, number[]];

        if (block.type === TERM) {
          // Enter in the term → move into the sibling definition (its start).
          const defPath = [...blockPath.slice(0, -1), 1];
          if (NodeApi.get(editor as never, defPath)) {
            const start = editor.api.start(defPath);
            if (start) {
              editor.tf.select(start);
              return;
            }
          }
          return insertBreak();
        }

        if (block.type === DEF) {
          // Enter in the definition → new entry below, cursor in its term.
          // Select the term explicitly: `select: true` would collapse to the
          // end of the inserted content (the new definition), not the term.
          const entryPath = blockPath.slice(0, -1);
          const newEntryPath = PathApi.next(entryPath);
          editor.tf.insertNodes(emptyEntry() as never, { at: newEntryPath });
          const termStart = editor.api.start([...newEntryPath, 0]);
          if (termStart) editor.tf.select(termStart);
          return;
        }

        return insertBreak();
      },

      deleteBackward(unit) {
        if (!editor.selection || editor.api.isExpanded()) {
          return deleteBackward(unit);
        }
        const blockEntry = editor.api.block();
        if (!blockEntry) return deleteBackward(unit);
        const [block, blockPath] = blockEntry as [TElement, number[]];

        if (block.type !== TERM && block.type !== DEF) {
          return deleteBackward(unit);
        }
        if (!editor.api.isStart(editor.selection.anchor, blockPath)) {
          return deleteBackward(unit);
        }

        if (block.type === DEF) {
          // At start of definition → hop to end of the term; never merge the
          // definition text up into the term.
          const termPath = [...blockPath.slice(0, -1), 0];
          const end = editor.api.end(termPath);
          if (end) {
            editor.tf.select(end);
            return;
          }
          return deleteBackward(unit);
        }

        // block.type === TERM, cursor at start.
        const entryPath = blockPath.slice(0, -1);
        const entryNode = NodeApi.get(editor as never, entryPath) as
          | Record<string, unknown>
          | undefined;
        const prevEntryPath = PathApi.previous(entryPath);

        if (isEntryEmpty(entryNode) && prevEntryPath) {
          // Empty entry, not the first → drop it, land at the end of the
          // previous entry's definition.
          const prevDefPath = [...prevEntryPath, 1];
          editor.tf.withoutNormalizing(() => {
            editor.tf.removeNodes({ at: entryPath });
            const end = editor.api.end(prevDefPath);
            if (end) editor.tf.select(end);
          });
          return;
        }

        if (prevEntryPath) {
          // Non-empty term at start, not the first entry → move to end of the
          // previous definition; don't merge across the entry boundary.
          const end = editor.api.end([...prevEntryPath, 1]);
          if (end) {
            editor.tf.select(end);
            return;
          }
        }

        // First entry, at the start of its term → swallow the backspace
        // (nothing to merge into without breaking out of the glossary).
        return;
      },
    },
  }),
);

export const BaseGlossaryEntryPlugin = createSlatePlugin({
  key: ENTRY,
  node: { isElement: true },
});

export const BaseGlossaryTermPlugin = createSlatePlugin({
  key: TERM,
  node: { isElement: true },
});

export const BaseGlossaryDefinitionPlugin = createSlatePlugin({
  key: DEF,
  node: { isElement: true },
});
