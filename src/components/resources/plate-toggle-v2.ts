"use client";

import {
  createSlatePlugin,
  NodeApi,
  type TElement,
} from "platejs";

/**
 * Container-shape toggle. JSON is structurally nested:
 *
 *   { type: "toggle_v2", children: [
 *       { type: "toggle_v2_summary", children: [{ text: "Title" }] },
 *       ...body blocks
 *   ] }
 *
 * Two transform overrides backstop the structural contract:
 *
 * 1. **normalizeNode** ensures the first child of any `toggle_v2` is a
 *    `toggle_v2_summary`. Without this, a user who deletes the summary
 *    (select-all + Backspace in the title row, then again to delete the
 *    now-empty summary node) leaves the toggle with body[0] sitting where
 *    the summary used to be. The element component reads
 *    `Children.toArray(children)[0]` as the summary; without the
 *    normaliser, body content would render as the title.
 *
 * 2. **insertBreak** on a cursor inside a `toggle_v2_summary` moves
 *    selection into the first body child instead of splitting the summary
 *    into two summary nodes. Slate's default Enter behaviour splits the
 *    current block — that would violate the "exactly one summary" rule and
 *    the element component would render only the first half as the title.
 *    Matches Notion / Google Docs: Enter in the toggle title moves you
 *    into the body, not a second title.
 */
export const BaseToggleV2Plugin = createSlatePlugin({
  key: "toggle_v2",
  node: { isElement: true },
}).overrideEditor(({ editor, tf: { normalizeNode, insertBreak } }) => ({
  transforms: {
    normalizeNode(entry) {
      const [node, path] = entry;
      const record = node as Record<string, unknown>;

      if (record.type === "toggle_v2") {
        const children = (record.children ?? []) as Record<string, unknown>[];
        if (
          children.length === 0 ||
          children[0]?.type !== "toggle_v2_summary"
        ) {
          editor.tf.insertNodes(
            {
              type: "toggle_v2_summary",
              children: [{ text: "" }],
            } as never,
            { at: [...path, 0] },
          );
          return;
        }
      }

      normalizeNode(entry);
    },

    insertBreak() {
      const blockEntry = editor.api.block();
      if (!blockEntry) return insertBreak();
      const [block, summaryPath] = blockEntry as [TElement, number[]];

      if (block.type !== "toggle_v2_summary") return insertBreak();

      // body[0] sits at parent.children[1] (summary is at index 0).
      const parentPath = summaryPath.slice(0, -1);
      const bodyPath: number[] = [...parentPath, 1];
      const bodyNode = NodeApi.get(editor as never, bodyPath);

      editor.tf.withoutNormalizing(() => {
        if (!bodyNode) {
          // `select: true` lands the cursor in the new empty paragraph.
          editor.tf.insertNodes(
            { type: "p", children: [{ text: "" }] } as never,
            { at: bodyPath, select: true },
          );
        } else {
          // Existing body[0]: select the block. Plate places the cursor at
          // the start of the block by default for a path-based selection.
          editor.tf.select(bodyPath);
        }
      });
    },
  },
}));

export const BaseToggleV2SummaryPlugin = createSlatePlugin({
  key: "toggle_v2_summary",
  node: { isElement: true },
});
