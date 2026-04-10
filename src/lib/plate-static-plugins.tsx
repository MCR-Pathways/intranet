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

const CALLOUT_STATIC_STYLES: Record<string, string> = {
  info: "background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;padding:1rem;border-radius:0.5rem;margin:0.5rem 0",
  success: "background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;padding:1rem;border-radius:0.5rem;margin:0.5rem 0",
  warning: "background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:1rem;border-radius:0.5rem;margin:0.5rem 0",
  error: "background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:1rem;border-radius:0.5rem;margin:0.5rem 0",
};

function CalloutStatic({ children, element, ...props }: SlateElementProps) {
  const variant = ((element as Record<string, unknown>).variant as string) || "info";
  const style = CALLOUT_STATIC_STYLES[variant] ?? CALLOUT_STATIC_STYLES.info;
  return (
    <SlateElement element={element} {...props}>
      <div role="note" style={cssStringToObject(style)}>
        {children}
      </div>
    </SlateElement>
  );
}

/** Convert a CSS string like "color:red;margin:0" to a React style object. */
function cssStringToObject(css: string): React.CSSProperties {
  const style: Record<string, string> = {};
  for (const declaration of css.split(";")) {
    const [prop, val] = declaration.split(":");
    if (prop && val) {
      const camelCase = prop.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      style[camelCase] = val.trim();
    }
  }
  return style;
}

// =============================================
// TABLE
// =============================================

function TableStatic({ children, ...props }: SlateElementProps) {
  return (
    <SlateElement {...props}>
      <table className="w-full border-collapse border border-border my-4">
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
  return createStaticEditor({
    plugins: staticPlugins,
    value,
    override: {
      components: staticComponents,
    },
  });
}
