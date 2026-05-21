"use client";

/**
 * Google Docs / MS Word style list continuation across void blocks.
 *
 * Plate's indent-list model treats lists as runs of consecutive same-style
 * paragraphs. A void block (img / file / media_embed) between two list
 * paragraphs breaks the chain — `getSiblingList` walks back from the
 * second paragraph, hits the void, and stops on either `breakOnLowerIndent`
 * or `breakOnEqIndentNeqListStyleType`. Pressing Enter on a void block then
 * inserts a plain paragraph, not a continuation of the surrounding list.
 *
 * This plugin intercepts `insertBreak` so that pressing Enter while the
 * cursor sits in a void block creates a new paragraph that inherits
 * indent + listStyleType from the nearest preceding list paragraph
 * (skipping intervening voids). `listRestart` is set to bridge.listStart + 1
 * because Plate's `normalizeListStart` would otherwise unset our
 * `listStart` (the chain still breaks at the void from Plate's POV).
 * `listRestart` is sticky — `normalizeListStart` reads it via
 * `getListExpectedListStart` and forces `listStart` to match.
 *
 * Out of scope for this iteration:
 * - Clearing `listRestart` when the void block is later deleted (gap
 *   closes, the post-image item is now adjacent to the original list,
 *   the explicit restart value may no longer reflect natural position).
 * - Bridging the chain at read time so static `<ol>` numbering across
 *   image breaks is also right without manual edit. Walker emits two
 *   separate lists; numbering resets in the static view. Acceptable
 *   because the migrated content uses `<ul>` (bullets — no visible
 *   numbering); this matters only when an editor converts to `<ol>`.
 */

import { createSlatePlugin, PathApi, NodeApi, type TElement } from "platejs";

const VOID_BLOCK_TYPES = new Set(["img", "file", "media_embed"]);
const LIST_PARAGRAPH_TYPE = "p";

function isVoidBlock(node: TElement | undefined): boolean {
  if (!node || typeof node.type !== "string") return false;
  return VOID_BLOCK_TYPES.has(node.type);
}

function isListParagraph(node: TElement | undefined): boolean {
  if (!node || node.type !== LIST_PARAGRAPH_TYPE) return false;
  const listStyleType = (node as TElement & { listStyleType?: unknown })
    .listStyleType;
  return typeof listStyleType === "string" && listStyleType.length > 0;
}

interface PrecedingListInfo {
  indent: number;
  listStyleType: string;
  listStart: number;
}

function findPrecedingListParagraph(
  editor: { children: TElement[] },
  path: number[],
): PrecedingListInfo | null {
  let cursor: number[] | undefined = PathApi.previous(path);
  while (cursor) {
    const node = NodeApi.get(editor as never, cursor) as TElement | undefined;
    if (!node) return null;
    if (isListParagraph(node)) {
      const n = node as TElement & {
        indent?: number;
        listStyleType?: string;
        listStart?: number;
      };
      return {
        indent: n.indent ?? 1,
        listStyleType: n.listStyleType as string,
        listStart: n.listStart ?? 1,
      };
    }
    if (!isVoidBlock(node)) return null;
    cursor = PathApi.previous(cursor);
  }
  return null;
}

export const ListContinuationPlugin = createSlatePlugin({
  key: "list_continuation",
}).overrideEditor(({ editor, tf: { insertBreak } }) => ({
  transforms: {
    insertBreak() {
      const blockEntry = editor.api.block();
      if (!blockEntry) return insertBreak();
      const [block, path] = blockEntry as [TElement, number[]];

      if (!isVoidBlock(block)) return insertBreak();

      const preceding = findPrecedingListParagraph(
        editor as { children: TElement[] },
        path,
      );
      if (!preceding) return insertBreak();

      // Insert the continuation paragraph right after the current void.
      const newPath = PathApi.next(path);

      editor.tf.withoutNormalizing(() => {
        editor.tf.insertNodes(
          {
            type: LIST_PARAGRAPH_TYPE,
            indent: preceding.indent,
            listStyleType: preceding.listStyleType,
            // listRestart is sticky — survives normalizeListStart, which
            // would otherwise reset listStart to 1 because the chain
            // breaks at the intervening void block.
            listRestart: preceding.listStart + 1,
            children: [{ text: "" }],
          } as never,
          { at: newPath },
        );
        editor.tf.select(newPath);
      });
    },
  },
}));
