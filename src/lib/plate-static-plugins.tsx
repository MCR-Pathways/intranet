/**
 * Shared static plugin registry for native Plate articles.
 *
 * Used by:
 * - plate-static-view.tsx (RSC read-only rendering)
 * - native-actions.ts (HTML serialisation for Algolia indexing)
 *
 * All static element/leaf components and plugin registrations live here
 * to avoid duplication between the two consumers.
 */

import type { Value } from "platejs";
import {
  createStaticEditor,
  SlateElement,
  SlateLeaf,
} from "platejs/static";
import {
  BaseHeadingPlugin,
  BaseBlockquotePlugin,
  BaseHorizontalRulePlugin,
  BaseBoldPlugin,
  BaseItalicPlugin,
  BaseUnderlinePlugin,
  BaseStrikethroughPlugin,
} from "@platejs/basic-nodes";
import { BaseLinkPlugin } from "@platejs/link";
import { BaseListPlugin } from "@platejs/list";
import { BaseCalloutPlugin } from "@platejs/callout";
import { BaseColumnPlugin, BaseColumnItemPlugin } from "@platejs/layout";
import { BaseTogglePlugin } from "@platejs/toggle";
import { BaseIndentPlugin } from "@platejs/indent";
import { createSlatePlugin } from "platejs";
import {
  BaseTablePlugin,
  BaseTableRowPlugin,
  BaseTableCellPlugin,
  BaseTableCellHeaderPlugin,
} from "@platejs/table";
import type { SlateElementProps, SlateLeafProps } from "platejs/static";

// =============================================
// STATIC ELEMENT COMPONENTS
// =============================================

function ParagraphStatic(props: SlateElementProps) {
  return <SlateElement {...props} as="p" />;
}

function BlockquoteStatic(props: SlateElementProps) {
  return <SlateElement {...props} as="blockquote" />;
}

function H1Static(props: SlateElementProps) {
  return <SlateElement {...props} as="h1" />;
}

function H2Static(props: SlateElementProps) {
  return <SlateElement {...props} as="h2" />;
}

function H3Static(props: SlateElementProps) {
  return <SlateElement {...props} as="h3" />;
}

function H4Static(props: SlateElementProps) {
  return <SlateElement {...props} as="h4" />;
}

function HrStatic(props: SlateElementProps) {
  return (
    <SlateElement {...props}>
      <hr />
      {props.children}
    </SlateElement>
  );
}

function LinkStatic({ children, element, ...props }: SlateElementProps) {
  const url = (element as Record<string, unknown>).url as string;
  return (
    <SlateElement element={element} {...props}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    </SlateElement>
  );
}

// =============================================
// CALLOUT
// =============================================

const CALLOUT_STATIC_CLASSES: Record<string, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200",
  success: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-200",
  warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200",
  error: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200",
};

function CalloutStatic({ children, element, ...props }: SlateElementProps) {
  const variant = ((element as Record<string, unknown>).variant as string) || "info";
  const classes = CALLOUT_STATIC_CLASSES[variant] ?? CALLOUT_STATIC_CLASSES.info;
  return (
    <SlateElement element={element} {...props}>
      <div role="note" className={`rounded-lg border p-4 my-2 ${classes}`}>
        {children}
      </div>
    </SlateElement>
  );
}

// =============================================
// TABLE
// =============================================

function TableStatic({ children, element, ...props }: SlateElementProps) {
  const colSizes = (element as Record<string, unknown>).colSizes as number[] | undefined;
  return (
    <SlateElement element={element} {...props}>
      <table className="w-full border-collapse border border-border my-4">
        {colSizes && (
          <colgroup>
            {colSizes.map((size, i) => (
              <col key={i} style={size ? { width: size } : undefined} />
            ))}
          </colgroup>
        )}
        <tbody>{children}</tbody>
      </table>
    </SlateElement>
  );
}

function TableRowStatic(props: SlateElementProps) {
  return <SlateElement {...props} as="tr" />;
}

function TableCellStatic({ children, element, ...props }: SlateElementProps) {
  return (
    <SlateElement element={element} {...props}>
      <td className="border border-border p-2 align-top">{children}</td>
    </SlateElement>
  );
}

function TableCellHeaderStatic({ children, element, ...props }: SlateElementProps) {
  return (
    <SlateElement element={element} {...props}>
      <th className="border border-border p-2 align-top bg-muted font-semibold text-left">
        {children}
      </th>
    </SlateElement>
  );
}

// =============================================
// COLUMNS
// =============================================

function ColumnGroupStatic({ children, ...props }: SlateElementProps) {
  return (
    <SlateElement {...props}>
      <div className="not-prose" style={{ display: "flex", gap: "1rem", margin: "1rem 0" }}>
        {children}
      </div>
    </SlateElement>
  );
}

function ColumnItemStatic({ children, element, ...props }: SlateElementProps) {
  const width = (element as Record<string, unknown>).width as string | undefined;
  return (
    <SlateElement element={element} {...props}>
      <div className="prose prose-sm" style={width ? { width, minWidth: 0 } : { flex: 1, minWidth: 0 }}>
        {children}
      </div>
    </SlateElement>
  );
}

// =============================================
// TOGGLE
// =============================================

function ToggleStatic({ children, ...props }: SlateElementProps) {
  return (
    <SlateElement {...props}>
      <details open>
        {children}
      </details>
    </SlateElement>
  );
}

function ToggleSummaryStatic({ children, ...props }: SlateElementProps) {
  return (
    <SlateElement {...props}>
      <summary className="cursor-pointer font-medium list-none flex items-center gap-1">
        {children}
      </summary>
    </SlateElement>
  );
}

/**
 * Convert the flat indent-based toggle model to a nested model for
 * static rendering. The editor stores toggle children as sibling blocks
 * with indent > 0. The static renderer needs them nested inside the
 * toggle's children array so they appear inside <details>.
 *
 * Only processes top-level nodes. Indented content NOT following a
 * toggle is left as-is.
 */
export function nestToggleChildren(value: Value): Value {
  const result: Value[number][] = [];
  let i = 0;

  while (i < value.length) {
    const node = value[i] as Record<string, unknown>;

    if (node.type !== "toggle") {
      result.push(value[i]);
      i++;
      continue;
    }

    // Copy the toggle node
    const toggle = { ...node };
    const originalChildren = (toggle.children ?? []) as Value[number][];
    const nestedChildren: Value[number][] = [];

    // Scan forward for indented siblings
    i++;
    while (i < value.length) {
      const sibling = value[i] as Record<string, unknown>;
      const indent = sibling.indent as number | undefined;

      if (!indent || indent <= 0) break;

      // Recursively handle nested toggles
      if (sibling.type === "toggle") {
        // Collect this nested toggle and its children
        const nestedSlice = collectToggleSlice(value, i);
        nestedChildren.push(...nestedSlice.nodes);
        i = nestedSlice.nextIndex;
      } else {
        // Strip the indent (decrement by 1) for the nested content
        const { indent: _indent, ...rest } = sibling;
        nestedChildren.push(rest as Value[number]);
        i++;
      }
    }

    // Wrap heading in toggle_summary, then append nested block children
    toggle.children = [
      { type: "toggle_summary", children: originalChildren },
      ...nestedChildren,
    ];
    result.push(toggle as Value[number]);
  }

  return result;
}

/** Collect a toggle and all its indented children from the flat array. */
function collectToggleSlice(
  value: Value,
  startIndex: number
): { nodes: Value[number][]; nextIndex: number } {
  const node = value[startIndex] as Record<string, unknown>;
  const toggle = { ...node };
  const originalChildren = (toggle.children ?? []) as Value[number][];
  const nestedChildren: Value[number][] = [];
  const baseIndent = (node.indent as number) ?? 0;

  let i = startIndex + 1;
  while (i < value.length) {
    const sibling = value[i] as Record<string, unknown>;
    const indent = (sibling.indent as number) ?? 0;

    if (indent <= baseIndent) break;

    if (sibling.type === "toggle") {
      const nested = collectToggleSlice(value, i);
      nestedChildren.push(...nested.nodes);
      i = nested.nextIndex;
    } else {
      const { indent: _indent, ...rest } = sibling;
      nestedChildren.push(rest as Value[number]);
      i++;
    }
  }

  toggle.children = [
    { type: "toggle_summary", children: originalChildren },
    ...nestedChildren,
  ];
  // Strip indent from the toggle itself
  const { indent: _indent, ...cleanToggle } = toggle;
  return { nodes: [cleanToggle as Value[number]], nextIndex: i };
}

// =============================================
// STATIC LEAF COMPONENTS
// =============================================

function BoldStatic(props: SlateLeafProps) {
  return <SlateLeaf {...props} as="strong" />;
}

function ItalicStatic(props: SlateLeafProps) {
  return <SlateLeaf {...props} as="em" />;
}

function UnderlineStatic(props: SlateLeafProps) {
  return <SlateLeaf {...props} as="u" />;
}

function StrikethroughStatic(props: SlateLeafProps) {
  return <SlateLeaf {...props} as="s" />;
}

// =============================================
// PLUGIN REGISTRY
// =============================================

/** Static-only plugin for the toggle_summary virtual node created by nestToggleChildren. */
const BaseToggleSummaryPlugin = createSlatePlugin({
  key: "toggle_summary",
  node: { isElement: true },
});

const staticPlugins = [
  BaseHeadingPlugin,
  BaseBlockquotePlugin,
  BaseHorizontalRulePlugin,
  BaseBoldPlugin,
  BaseItalicPlugin,
  BaseUnderlinePlugin,
  BaseStrikethroughPlugin,
  BaseLinkPlugin,
  BaseListPlugin,
  BaseCalloutPlugin,
  BaseTablePlugin,
  BaseTableRowPlugin,
  BaseTableCellPlugin,
  BaseTableCellHeaderPlugin,
  BaseColumnPlugin,
  BaseColumnItemPlugin,
  BaseIndentPlugin,
  BaseTogglePlugin,
  BaseToggleSummaryPlugin,
];

const staticComponents = {
  p: ParagraphStatic,
  blockquote: BlockquoteStatic,
  h1: H1Static,
  h2: H2Static,
  h3: H3Static,
  h4: H4Static,
  hr: HrStatic,
  a: LinkStatic,
  callout: CalloutStatic,
  table: TableStatic,
  tr: TableRowStatic,
  td: TableCellStatic,
  th: TableCellHeaderStatic,
  column_group: ColumnGroupStatic,
  column: ColumnItemStatic,
  toggle: ToggleStatic,
  toggle_summary: ToggleSummaryStatic,
  bold: BoldStatic,
  italic: ItalicStatic,
  underline: UnderlineStatic,
  strikethrough: StrikethroughStatic,
};

// =============================================
// PUBLIC API
// =============================================

/**
 * Create a static editor instance with all native article plugins
 * and component mappings. Used for both RSC rendering and HTML
 * serialisation in server actions.
 */
export function createNativeStaticEditor(value: Value) {
  // Preprocess: convert flat indent-based toggles to nested model for static rendering
  const processedValue = nestToggleChildren(value);

  return createStaticEditor({
    plugins: staticPlugins,
    value: processedValue,
    override: {
      components: staticComponents,
    },
  });
}
