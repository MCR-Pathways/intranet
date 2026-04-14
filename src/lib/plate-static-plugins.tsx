/**
 * Shared static plugin registry for native Plate articles.
 *
 * Used by:
 * - NativeArticleView (via prepareNativeArticle — rendering with heading IDs)
 * - native-actions.ts (via createNativeStaticEditor — Algolia HTML serialisation, no heading IDs)
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
import { BaseImagePlugin, BaseMediaEmbedPlugin, BaseFilePlugin } from "@platejs/media";
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
import { formatFileSize } from "@/lib/utils";
import {
  createSlugDeduplicator,
  ARTICLE_CONTENT_MODIFIERS,
  APP_ORIGIN,
  type ArticleHeading,
} from "./article-constants";

// =============================================
// STATIC ELEMENT COMPONENTS
// =============================================

function ParagraphStatic(props: SlateElementProps) {
  return <SlateElement {...props} as="p" />;
}

function BlockquoteStatic(props: SlateElementProps) {
  return <SlateElement {...props} as="blockquote" />;
}

/** Inline SVG link icon for heading anchors (RSC-safe — no lucide-react import). */
function LinkIconSvg() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function HeadingStatic(props: SlateElementProps, Tag: "h1" | "h2" | "h3" | "h4") {
  const id = (props.element as Record<string, unknown>).id as string | undefined;

  // No-id path (Algolia serialisation): render with as={Tag} so the heading
  // IS the top-level element. Without `as`, SlateElement wraps in a <div>,
  // which breaks parseHtmlIntoSections (it checks body.children for heading tags).
  if (!id) {
    return <SlateElement {...props} as={Tag} />;
  }

  // Id path (browser rendering): wrap heading in SlateElement, add anchor link
  const { element, children, ...rest } = props;
  return (
    <SlateElement element={element} {...rest}>
      <Tag id={id} className="group relative scroll-mt-20">
        <a
          href={`#${id}`}
          aria-hidden
          tabIndex={-1}
          className="absolute -left-5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity select-none [text-decoration:none] [color:var(--color-muted-foreground)]"
        >
          <LinkIconSvg />
        </a>
        {children}
      </Tag>
    </SlateElement>
  );
}

function H1Static(props: SlateElementProps) {
  return HeadingStatic(props, "h1");
}

function H2Static(props: SlateElementProps) {
  return HeadingStatic(props, "h2");
}

function H3Static(props: SlateElementProps) {
  return HeadingStatic(props, "h3");
}

function H4Static(props: SlateElementProps) {
  return HeadingStatic(props, "h4");
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

  // Check if link is internal: relative path or absolute intranet URL
  let href = url;
  let isInternal = url.startsWith("/") && !url.startsWith("//");

  if (!isInternal && APP_ORIGIN) {
    try {
      const parsed = new URL(url);
      if (parsed.origin === APP_ORIGIN) {
        href = parsed.pathname + parsed.search + parsed.hash || "/";
        isInternal = true;
      }
    } catch { /* not a valid URL, treat as external */ }
  }

  return (
    <SlateElement element={element} {...props}>
      <a
        href={href}
        {...(!isInternal && { target: "_blank", rel: "noopener noreferrer" })}
      >
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
      <td className="align-top">{children}</td>
    </SlateElement>
  );
}

function TableCellHeaderStatic({ children, element, ...props }: SlateElementProps) {
  return (
    <SlateElement element={element} {...props}>
      <th className="align-top">{children}</th>
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
      <div className={`prose prose-sm ${ARTICLE_CONTENT_MODIFIERS} p-3`} style={width ? { width, minWidth: 0 } : { flex: 1, minWidth: 0 }}>
        {children}
      </div>
    </SlateElement>
  );
}

// =============================================
// IMAGE
// =============================================

const IMAGE_ALIGN_CLASSES: Record<string, string> = {
  left: "rounded-lg max-w-full block",
  center: "rounded-lg max-w-full mx-auto block",
  right: "rounded-lg max-w-full ml-auto block",
};

function ImageStatic({ children, element, ...props }: SlateElementProps) {
  const url = (element as Record<string, unknown>).url as string;
  const alt = (element as Record<string, unknown>).alt as string | undefined;
  const width = (element as Record<string, unknown>).width as number | undefined;
  const height = (element as Record<string, unknown>).height as number | undefined;
  const align = ((element as Record<string, unknown>).align as string) || "center";
  return (
    <SlateElement element={element} {...props}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Plate static renderer, can't use next/image */}
      <img
        src={url}
        alt={alt ?? ""}
        className={IMAGE_ALIGN_CLASSES[align] ?? IMAGE_ALIGN_CLASSES.center}
        loading="lazy"
        width={width}
        height={height}
        style={width ? { height: "auto" } : undefined}
      />
      {children}
    </SlateElement>
  );
}

// =============================================
// VIDEO EMBED
// =============================================

function MediaEmbedStatic({ children, element, ...props }: SlateElementProps) {
  const url = (element as Record<string, unknown>).url as string;
  return (
    <SlateElement element={element} {...props}>
      <div className="not-prose my-4 aspect-video w-full overflow-hidden rounded-lg bg-muted">
        <iframe
          src={url}
          title="Embedded video"
          className="h-full w-full"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
      {children}
    </SlateElement>
  );
}

// =============================================
// FILE ATTACHMENT
// =============================================

function FileStatic({ children, element, ...props }: SlateElementProps) {
  const url = (element as Record<string, unknown>).url as string;
  const name = (element as Record<string, unknown>).name as string | undefined;
  const size = (element as Record<string, unknown>).size as number | undefined;

  const sizeText = size ? formatFileSize(size) : "";

  return (
    <SlateElement element={element} {...props}>
      <a
        href={url}
        download
        className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 my-2 hover:bg-muted/50 transition-colors no-underline text-foreground"
      >
        {/* Lucide FileText icon paths (RSC-safe, matches editor element) */}
        <svg className="h-5 w-5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
          <path d="M14 2v5a1 1 0 0 0 1 1h5" />
          <path d="M10 9H8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
        </svg>
        <span className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">{name ?? "File"}</span>
          {sizeText && <span className="text-xs text-muted-foreground">{sizeText}</span>}
        </span>
        <span className="text-xs text-muted-foreground">Download</span>
      </a>
      {children}
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
    const baseIndent = (node.indent as number) ?? 0;

    // Scan forward for indented siblings (indent > this toggle's level)
    i++;
    while (i < value.length) {
      const sibling = value[i] as Record<string, unknown>;
      const indent = (sibling.indent as number) ?? 0;

      if (indent <= baseIndent) break;

      if (sibling.type === "toggle") {
        const nestedSlice = collectToggleSlice(value, i);
        nestedChildren.push(...nestedSlice.nodes);
        i = nestedSlice.nextIndex;
      } else {
        // Decrement indent relative to toggle level, preserving multi-level hierarchy
        const newIndent = indent - (baseIndent + 1);
        const { indent: _indent, ...rest } = sibling;
        nestedChildren.push({ ...rest, ...(newIndent > 0 ? { indent: newIndent } : {}) } as Value[number]);
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
      // Decrement indent relative to toggle level, preserving multi-level hierarchy
      const newIndent = indent - (baseIndent + 1);
      const { indent: _indent, ...rest } = sibling;
      nestedChildren.push({ ...rest, ...(newIndent > 0 ? { indent: newIndent } : {}) } as Value[number]);
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
  BaseImagePlugin,
  BaseMediaEmbedPlugin,
  BaseFilePlugin,
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
  img: ImageStatic,
  media_embed: MediaEmbedStatic,
  file: FileStatic,
  toggle_summary: ToggleSummaryStatic,
  bold: BoldStatic,
  italic: ItalicStatic,
  underline: UnderlineStatic,
  strikethrough: StrikethroughStatic,
};

// =============================================
// HEADING ID PREPROCESSOR
// =============================================

const HEADING_TYPES = new Set(["h1", "h2", "h3", "h4"]);
const HEADING_LEVEL: Record<string, number> = { h1: 1, h2: 2, h3: 3, h4: 4 };

/** Extract text from a Plate node's children recursively. */
function getPlateNodeText(node: Record<string, unknown>): string {
  if (typeof node.text === "string") return node.text;
  const children = node.children as Record<string, unknown>[] | undefined;
  if (!children) return "";
  return children.map(getPlateNodeText).join("");
}

/**
 * Walk Plate JSON, find h1-h4 nodes, generate slugs, and add `id`
 * properties. Returns both the modified value and extracted headings.
 *
 * Creates new objects for modified nodes — does NOT mutate originals.
 * nestToggleChildren only shallow-copies toggle nodes; heading nodes
 * are original references that must not be mutated.
 */
export function addHeadingIds(value: Value): {
  value: Value;
  headings: ArticleHeading[];
} {
  const deduplicate = createSlugDeduplicator();
  const headings: ArticleHeading[] = [];

  function walkAndCopy(nodes: Value[number][]): Value[number][] {
    let changed = false;
    const result = nodes.map((node) => {
      const record = node as Record<string, unknown>;
      const type = record.type as string | undefined;
      const children = record.children as Value[number][] | undefined;

      // Recurse into children first (toggles, columns, etc.)
      const newChildren = children ? walkAndCopy(children) : undefined;

      if (type && HEADING_TYPES.has(type)) {
        const text = getPlateNodeText(record).trim();
        if (text) {
          const slug = deduplicate(text);
          headings.push({ text, slug, level: HEADING_LEVEL[type] });
          changed = true;
          // Create new object with id — don't mutate original
          return {
            ...record,
            id: slug,
            ...(newChildren ? { children: newChildren } : {}),
          } as unknown as Value[number];
        }
      }

      // Only create new object if children changed
      if (newChildren && newChildren !== children) {
        changed = true;
        return { ...record, children: newChildren } as Value[number];
      }
      return node;
    });

    return changed ? result : nodes;
  }

  return { value: walkAndCopy(value as Value[number][]) as Value, headings };
}

// =============================================
// PUBLIC API
// =============================================

/**
 * Create a static editor instance for Algolia HTML serialisation.
 * Does NOT add heading IDs — keeps serialised HTML clean for search indexing.
 * Used by native-actions.ts.
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

/**
 * Prepare a native article for rendering with heading IDs and TOC data.
 * Chains nestToggleChildren → addHeadingIds → createStaticEditor.
 *
 * Used by NativeArticleView — returns both the editor and extracted
 * headings for the TOC sidebar. Heading slugs are guaranteed to match
 * the DOM heading IDs since both come from the same walk.
 */
export function prepareNativeArticle(value: Value): {
  editor: ReturnType<typeof createStaticEditor>;
  headings: ArticleHeading[];
} {
  const nested = nestToggleChildren(value);
  const { value: processed, headings } = addHeadingIds(nested);

  const editor = createStaticEditor({
    plugins: staticPlugins,
    value: processed,
    override: {
      components: staticComponents,
    },
  });

  return { editor, headings };
}
