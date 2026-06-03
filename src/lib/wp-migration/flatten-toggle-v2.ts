/**
 * Flatten container-shape `toggle_v2` nodes back to plain headings + inline
 * body content.
 *
 * Motivation: Algolia's section indexer (`src/lib/html-sections.ts`) only
 * splits on H1–H4 headings. `toggle_v2_summary` text is searchable inside
 * its parent heading's section record but does NOT produce its own section
 * record or its own deep-link anchor. For pages where toggle titles are
 * search-target nouns (policy names, procedure step titles, known docs),
 * flattening to heading + content moves the title into the heading set so
 * Cmd+K results deep-link precisely.
 *
 * Input shape:
 *
 *   [
 *     { type: "h2", children: [...] },
 *     { type: "toggle_v2", children: [
 *       { type: "toggle_v2_summary", children: [{ text: "Step title" }] },
 *       { type: "p", children: [...] },
 *       { type: "ol-item", indent: 1, ... },
 *       { type: "h3", children: [...] },               ← nested sub-heading
 *     ] },
 *     { type: "p", children: [...] },                   ← outside the toggle
 *   ]
 *
 * Output shape (toggle promoted to `h3`, body inlined as siblings, the
 * nested `h3` demoted to `h4` because its parent is now `h3` instead of
 * the toggle's body context):
 *
 *   [
 *     { type: "h2", children: [...] },
 *     { type: "h3", children: [{ text: "Step title" }] },
 *     { type: "p", children: [...] },
 *     { type: "ol-item", indent: 1, ... },
 *     { type: "h4", children: [...] },                  ← demoted
 *     { type: "p", children: [...] },
 *   ]
 *
 * Heading level for the promoted summary defaults to `h3`. Override via
 * `options.summaryHeadingLevel` (e.g., `h2` for a single toggle that's
 * really a section heading in disguise — pc-support PC Guidebook case).
 *
 * Nested headings inside the toggle body are demoted by one level so the
 * outline shape stays consistent. An `h3` inside the body becomes `h4`
 * when the promoted summary is `h3`; an `h2` inside the body becomes `h3`
 * when the promoted summary is `h2`; etc. Demotion stops at `h6` (Plate's
 * deepest heading level).
 *
 * Toggles in the body of another toggle are recursively flattened with
 * the outer's summary level + 1 (so a toggle nested under a flattened-to-h3
 * outer becomes an `h4`, matching the heading-demotion rule).
 *
 * Toggles whose summary text matches one of `options.exclude` (case-
 * insensitive, trimmed) stay as `toggle_v2`. Use this for the people-services
 * COSHH Assessments case where the audit decided to keep the toggle.
 */

import type { Value } from "platejs";

type PlateNode = Value[number] & {
  type: string;
  children?: unknown[];
};

export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export interface FlattenOptions {
  /**
   * Heading level the promoted toggle summary takes. Defaults to "h3".
   */
  summaryHeadingLevel?: HeadingLevel;
  /**
   * Toggle summary titles that should NOT be flattened. Matched case-
   * insensitive against the concatenated text of the summary's children,
   * trimmed. Use for per-page exceptions (e.g., ["COSHH Assessments"]).
   */
  exclude?: string[];
}

export interface FlattenResult {
  value: Value;
  flattenedCount: number;
  skippedCount: number;
  demotionCount: number;
}

const HEADING_LEVELS: HeadingLevel[] = ["h1", "h2", "h3", "h4", "h5", "h6"];

export function flattenToggleV2(
  value: Value,
  options: FlattenOptions = {},
): FlattenResult {
  const summaryLevel = options.summaryHeadingLevel ?? "h3";
  const excludeSet = new Set(
    (options.exclude ?? []).map((s) => s.toLowerCase().trim()),
  );
  return walk(value as PlateNode[], summaryLevel, excludeSet);
}

function walk(
  nodes: PlateNode[],
  summaryLevel: HeadingLevel,
  excludeSet: Set<string>,
): FlattenResult {
  const result: PlateNode[] = [];
  let flattenedCount = 0;
  let skippedCount = 0;
  let demotionCount = 0;

  for (const node of nodes) {
    if (node.type !== "toggle_v2") {
      result.push(node);
      continue;
    }

    const children = (node.children ?? []) as PlateNode[];
    const summary = children[0];
    if (!summary || summary.type !== "toggle_v2_summary") {
      // Defensive: toggle_v2 without a summary as first child shouldn't
      // exist (normalizeNode in BaseToggleV2Plugin enforces it), but if
      // it does, leave the node alone rather than guessing.
      result.push(node);
      continue;
    }

    const summaryText = extractText(summary).toLowerCase().trim();
    if (excludeSet.has(summaryText)) {
      skippedCount++;
      result.push(node);
      continue;
    }

    flattenedCount++;

    // Promote summary to heading.
    result.push({
      type: summaryLevel,
      children: summary.children ?? [{ text: "" }],
    } as PlateNode);

    // Process body children. Demote nested headings by one level; flatten
    // nested toggles recursively at the next level down; pass everything
    // else through unchanged.
    const body = children.slice(1);
    const nextSummaryLevel = demoteHeading(summaryLevel);
    for (const bodyNode of body) {
      if (bodyNode.type === "toggle_v2") {
        const nested = walk(
          [bodyNode] as PlateNode[],
          nextSummaryLevel,
          excludeSet,
        );
        flattenedCount += nested.flattenedCount;
        skippedCount += nested.skippedCount;
        demotionCount += nested.demotionCount;
        result.push(...(nested.value as PlateNode[]));
      } else if (isHeading(bodyNode)) {
        const demoted = demoteHeading(bodyNode.type as HeadingLevel);
        if (demoted !== bodyNode.type) demotionCount++;
        result.push({ ...bodyNode, type: demoted });
      } else {
        result.push(bodyNode);
      }
    }
  }

  return {
    value: result as Value,
    flattenedCount,
    skippedCount,
    demotionCount,
  };
}

function isHeading(node: PlateNode): boolean {
  return HEADING_LEVELS.includes(node.type as HeadingLevel);
}

function demoteHeading(level: HeadingLevel): HeadingLevel {
  const idx = HEADING_LEVELS.indexOf(level);
  if (idx < 0 || idx === HEADING_LEVELS.length - 1) return level; // h6 stays h6
  return HEADING_LEVELS[idx + 1];
}

function extractText(node: PlateNode): string {
  const children = (node.children ?? []) as PlateNode[];
  let out = "";
  for (const child of children) {
    const maybeText = (child as unknown as { text?: unknown }).text;
    if (typeof maybeText === "string") {
      out += maybeText;
    } else if (child.children) {
      out += extractText(child);
    }
  }
  return out;
}
