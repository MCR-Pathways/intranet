/**
 * Convert stored indent-shape `toggle` content_json to container-shape
 * `toggle_v2`.
 *
 * Input shape (legacy, what's in the DB for articles migrated before the
 * walker's container-shape switch):
 *
 *   [
 *     { type: "h3", children: [...] },
 *     { type: "toggle", children: [{ text: "Title" }] },
 *     { type: "p", indent: 1, children: [...] },     ← in-body
 *     { type: "ol-item", indent: 2, listStyleType: "decimal", ... },
 *     { type: "h3", children: [...] },               ← closes the toggle
 *   ]
 *
 * The legacy walker's `indentToggleBodies` post-pass added +1 to every
 * non-toggle, non-heading node following a toggle until a heading at the
 * parent level or shallower closed the scope (mirrors the rule the
 * walker's current `groupToggleBodies` uses for grouping).
 *
 * Output shape:
 *
 *   [
 *     { type: "h3", children: [...] },
 *     { type: "toggle_v2", children: [
 *       { type: "toggle_v2_summary", children: [{ text: "Title" }] },
 *       { type: "p", children: [...] },              ← indent stripped
 *       { type: "ol-item", indent: 1, listStyleType: "decimal", ... },
 *     ] },
 *     { type: "h3", children: [...] },
 *   ]
 *
 * The conversion strips one level of indent from each body item because
 * the container-shape toggle's CSS handles visual offsetting via its own
 * padding-left on body children — adding the +1 indent margin on top
 * would double the offset compared to the legacy rendering.
 */

import type { Value } from "platejs";

type PlateNode = Value[number] & {
  type: string;
  children?: unknown[];
  indent?: number;
};

interface ConvertResult {
  value: Value;
  toggleCount: number;
}

/**
 * Walk a Plate value, fold each `toggle` marker plus its scope-bounded
 * body siblings into a container-shape `toggle_v2` node, and strip the
 * +1 indent that `indentToggleBodies` added to body items.
 *
 * Scope rule matches the walker's `groupToggleBodies` exactly: body
 * extends until the next sibling `toggle`, a heading at the surrounding
 * parent level or shallower, or end of slice. Headings deeper than the
 * parent level stay inside the body.
 */
export function convertStoredToggles(value: Value): ConvertResult {
  return walk(value as PlateNode[], 0);
}

function walk(nodes: PlateNode[], parentLevel: number): ConvertResult {
  const result: PlateNode[] = [];
  let i = 0;
  let mostRecentHeadingLevel = parentLevel;
  let toggleCount = 0;

  while (i < nodes.length) {
    const node = nodes[i];
    const headingLevel = headingLevelOf(node);

    if (node.type === "toggle") {
      toggleCount++;
      const toggleParentLevel = mostRecentHeadingLevel;
      const titleChildren = node.children ?? [{ text: "" }];
      const bodySlice: PlateNode[] = [];
      i++;

      while (i < nodes.length) {
        const next = nodes[i];

        // Sibling toggle starts a new accordion item at the same parent
        // level — close this one's body.
        if (next.type === "toggle") break;

        const nextHeadingLevel = headingLevelOf(next);
        if (
          nextHeadingLevel > 0 &&
          nextHeadingLevel <= toggleParentLevel
        ) {
          break;
        }

        bodySlice.push(stripBodyIndent(next));
        i++;
      }

      // Recurse so any nested toggle markers inside the body also become
      // container-shape. Current stored content emits siblings, not
      // nested, so this is typically a no-op pass.
      const groupedBody = walk(bodySlice, toggleParentLevel);
      toggleCount += groupedBody.toggleCount;

      result.push({
        type: "toggle_v2",
        children: [
          { type: "toggle_v2_summary", children: titleChildren },
          ...groupedBody.value,
        ],
      } as PlateNode);
    } else {
      if (headingLevel > 0) mostRecentHeadingLevel = headingLevel;
      result.push(node);
      i++;
    }
  }

  return { value: result as Value, toggleCount };
}

function headingLevelOf(node: PlateNode): number {
  const match = /^h([1-6])$/.exec(node.type ?? "");
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Decrement a body item's indent by one. If the result is 0 or below,
 * strip the `indent` property entirely (Plate's typed Insert doesn't
 * accept `indent: 0` as a meaningful value, and absent is cleaner than
 * a sentinel zero).
 */
function stripBodyIndent(node: PlateNode): PlateNode {
  const currentIndent = node.indent ?? 0;
  if (currentIndent <= 1) {
    const { indent: _stripped, ...rest } = node;
    return rest as PlateNode;
  }
  return { ...node, indent: currentIndent - 1 };
}
