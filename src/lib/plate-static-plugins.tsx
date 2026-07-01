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

import { createElement } from "react";
import type { Value } from "platejs";
import {
  createStaticEditor,
  SlateElement,
  SlateLeaf,
} from "platejs/static";
import { ChevronRight } from "lucide-react";
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
import { BaseIndentPlugin } from "@platejs/indent";
import { createSlatePlugin } from "platejs";
import {
  BaseTablePlugin,
  BaseTableRowPlugin,
  BaseTableCellPlugin,
  BaseTableCellHeaderPlugin,
} from "@platejs/table";
import type { SlateElementProps, SlateLeafProps } from "platejs/static";
import { resolveResourceCell, groupResourceGrids } from "./resource-grid";
import {
  createSlugDeduplicator,
  slugifyHeading,
  ARTICLE_CONTENT_MODIFIERS,
  APP_ORIGIN,
  type ArticleHeading,
} from "./article-constants";
import { glossaryEntryText } from "./glossary-text";

// =============================================
// STATIC ELEMENT COMPONENTS
// =============================================

function ParagraphStatic(props: SlateElementProps) {
  // Indent-list paragraphs become <div> instead of <p> — Plate renders a
  // <ul>/<ol> child inside, and <p> can't contain block-level <ul>/<ol>
  // (invalid HTML → hydration warnings). <div> wraps the list cleanly while
  // preserving Plate's data-slate-* attributes for selection tracking.
  const el = props.element as Record<string, unknown>;
  const isListStyled = Boolean(el.indent && el.listStyleType);
  return <SlateElement {...props} as={isListStyled ? "div" : "p"} />;
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

/**
 * Algolia-mode heading: always render heading as the top-level element so
 * parseHtmlIntoSections (which inspects body.children) can see it. Used by
 * createNativeStaticEditor only.
 *
 * Browser rendering uses the regular HeadingStatic which wraps in SlateElement
 * to add Slate's data-* attributes + the anchor-link affordance. That path
 * stays unchanged. The Algolia path must NEVER produce `<div><h2>...</h2></div>`
 * because parseHtmlIntoSections walks body.children only — a heading nested
 * inside a div is invisible to the indexer, and every native article ends up
 * as a single Algolia section regardless of its heading count.
 */
function AlgoliaH1Static(props: SlateElementProps) {
  return <SlateElement {...props} as="h1" />;
}
function AlgoliaH2Static(props: SlateElementProps) {
  return <SlateElement {...props} as="h2" />;
}
function AlgoliaH3Static(props: SlateElementProps) {
  return <SlateElement {...props} as="h3" />;
}
function AlgoliaH4Static(props: SlateElementProps) {
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

function LinkStatic({ children, element, attributes }: SlateElementProps) {
  const url = ((element as Record<string, unknown>).url as string) || "";

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

  // Render <a> directly without SlateElement wrapper. The default wrapper
  // emits <div data-slate-inline={true}> around inline elements, which is
  // invalid HTML inside <p>. Spreading `attributes` keeps Slate's per-node
  // ref + data-slate-* attributes on the <a> itself.
  return (
    <a
      {...attributes}
      href={href}
      {...(!isInternal && { target: "_blank", rel: "noopener noreferrer" })}
    >
      {children}
    </a>
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
  // MCR-hosted videos (served via /api/drive-file/{id}) render with the native
  // <video> element so we get controls + manual play (no autoplay). External
  // YouTube/Vimeo videos stay as iframes — the embed providers handle their
  // own play UI. Note: `autoplay` removed from the allow= list on the iframe
  // path too, so an external embed can't request autoplay either.
  const isLocalVideo = url.startsWith("/api/drive-file/");
  return (
    <SlateElement element={element} {...props}>
      <div className="not-prose my-4 aspect-video w-full overflow-hidden rounded-lg bg-muted">
        {isLocalVideo ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- MCR-hosted author-uploaded video, no caption file; no VTT-upload flow exists yet (deferred: "Video captions" in docs/plan.md)
          <video
            src={url}
            controls
            preload="metadata"
            playsInline
            className="h-full w-full"
          />
        ) : (
          <iframe
            src={url}
            title="Embedded video"
            className="h-full w-full"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        )}
      </div>
      {children}
    </SlateElement>
  );
}

// =============================================
// FILE ATTACHMENT
// =============================================

// Office MIME types — for these we route the link to Drive's /preview URL so
// a new-tab click renders the file in Drive's native viewer. PDFs / images
// / text / CSV go through our /api/drive-file proxy and render in the
// browser's own viewer.
const OFFICE_DOC_MIMES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

/**
 * Documents (PDFs, Office docs, images-as-files, plain text) render as a
 * plain inline hyperlink — same visual treatment as external links such as
 * Google Slides URLs. Click opens the file in a new tab where the browser's
 * native viewer (or Drive's /preview viewer for Office docs) takes over.
 *
 * No download card, no inline iframe. Keeps articles with many attached
 * documents compact and consistent with the rest of the link UX.
 *
 * The /preview routing for Office docs requires the file to be domain-shared
 * with the org domain — the WP migration's asset uploader and the news-feed
 * upload pipeline both call `shareFileWithDomain()` to ensure this.
 */
function FileStatic({ children, element, attributes }: SlateElementProps) {
  const url = (element as Record<string, unknown>).url as string;
  const name = (element as Record<string, unknown>).name as string | undefined;
  const mimeType = (element as Record<string, unknown>).mimeType as string | undefined;

  const driveFileId = url.match(/\/api\/drive-file\/([^/?#]+)/)?.[1];
  const href =
    mimeType && OFFICE_DOC_MIMES.has(mimeType) && driveFileId
      ? `https://drive.google.com/file/d/${driveFileId}/preview`
      : url;

  return (
    <a
      {...attributes}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {name ?? "Document"}
      {children}
    </a>
  );
}

/**
 * Content-aware resource grid (§2). Render-only: `groupResourceGrids`
 * (browser path) wraps runs of 4+ `file`/standalone-link cells in a
 * `resource_grid` node. This reads the raw child nodes and renders each as a
 * Direction-A card with a Style-C type chip — it deliberately does NOT render
 * the default `children`, so the file/link nodes become tiles rather than
 * their inline forms. Never on the Algolia path, so indexing is unaffected.
 */
function ResourceGrid({ element, attributes }: SlateElementProps) {
  const cells = ((element as Record<string, unknown>).children as Record<string, unknown>[]) ?? [];
  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- list-none removes the implicit list role in Safari/VoiceOver; role="list" restores it
    <ul
      {...attributes}
      role="list"
      className="not-prose my-5 grid list-none grid-cols-2 gap-3 pl-0 lg:grid-cols-3"
    >
      {cells.map((cell, i) => {
        const info = resolveResourceCell(cell);
        if (!info) return null;
        const { name, href, newTab, config } = info;
        const Icon = config.Icon;
        return (
          <li key={`${i}-${href}`} className="m-0">
            <a
              href={href}
              {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="flex h-full items-center gap-3 rounded-lg border border-border bg-card p-3 no-underline transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                {createElement(Icon, { className: "h-5 w-5" })}
              </span>
              <span className="min-w-0 text-sm font-medium leading-snug text-foreground">
                {name}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

// =============================================
// TOGGLE
// =============================================

// Hairline-list accordion matching the OLD intranet's Elementor toggle
// styling (verified via DOM inspection 2026-05-21):
//   - No card container, no border, no background. Adjacent toggles
//     stack as a continuous list. Separation comes from each title's
//     own padding + the bold font weight.
//   - `as="details"` makes the SlateElement BE the <details> element
//     (HTML5 requires <summary> to be a direct child of <details>;
//     without `as`, the wrapping div breaks that and the browser falls
//     back to the default "Details" label).
//   - No `open` attribute → toggles default to collapsed. The whole
//     point of the pattern is the user opens what they want to read.
//   - `group/toggle` parents the chevron's rotation animation so it
//     responds to the <details>'s open/closed state.
//   - Body content gets `px-4` so it visually indents under the title;
//     adjacent toggles' titles remain flush-left so the list reads as
//     a single column of options.
function ToggleStatic({ children, ...props }: SlateElementProps) {
  return (
    <SlateElement
      {...props}
      as="details"
      className="group/toggle [&>*:not(summary)]:px-4 [&>*:not(summary):first-of-type]:pt-1 [&>*:not(summary):last-child]:pb-3"
    >
      {children}
    </SlateElement>
  );
}

// `as="summary"` makes the SlateElement BE the <summary>, satisfying
// HTML5's direct-child requirement. The rest matches the OLD's
// `.elementor-tab-title`:
//   - `font-semibold` (bold) — OLD used font-weight 700.
//   - `py-3 px-2` — OLD used 15px padding around the title; the
//     horizontal padding stays light so the title doesn't drift away
//     from the surrounding article body.
//   - Hover background + focus-visible state for legibility — the OLD
//     relied on cursor change alone, but adding a subtle hover is a
//     low-risk improvement for the new platform without changing the
//     core silhouette.
//   - `[&::-webkit-details-marker]:hidden` covers Safari in addition to
//     `list-none` (Firefox/Chrome). Only our custom chevron renders.
function ToggleSummaryStatic({ children, ...props }: SlateElementProps) {
  return (
    <SlateElement
      {...props}
      as="summary"
      className="flex items-center gap-2 cursor-pointer list-none px-2 py-3 font-semibold text-foreground rounded-md hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
    >
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open/toggle:rotate-90"
      />
      <span className="flex-1">{children}</span>
    </SlateElement>
  );
}

// =============================================
// GLOSSARY
// =============================================

// Browser path: a real definition list. `glossary` → <dl>,
// `glossary_entry` → <div class="glossary-entry"> (a valid name/value group
// inside <dl>, and the unit the on-page filter shows/hides), `glossary_term`
// → <dt>, `glossary_definition` → <dd>. The <dt> carries a slug id derived
// the same way parseHtmlIntoSections derives section slugs, so the Cmd+K
// deep-link anchor matches the indexed section. Terms are <dt>, not headings,
// so they never reach the article TOC.
//
// `data-glossary-text` on each entry is the lower-cased term + definition
// text — the hook the PR2 on-page filter reads to show/hide entries without
// re-touching this component.

function GlossaryStatic({ children, element, ...props }: SlateElementProps) {
  const variant = (element as Record<string, unknown>).variant as string | undefined;
  return (
    <SlateElement
      element={element}
      {...props}
      as="dl"
      data-variant={variant}
      className={`glossary not-prose my-3${variant === "acronyms" ? " glossary-acronyms" : ""}`}
    >
      {children}
    </SlateElement>
  );
}

function GlossaryEntryStatic({ children, element, ...props }: SlateElementProps) {
  // Term + definition joined with a space (shared with the on-page filter via
  // glossary-text.ts) — not "", which would glue the term to the definition's
  // first word and break the filter at that boundary.
  const text = glossaryEntryText(element);
  return (
    <SlateElement element={element} {...props}>
      {/* Layout (divider, stacked-vs-two-column, padding) lives in globals.css
          .glossary-entry / .glossary-acronyms so the editor matches exactly. */}
      <div className="glossary-entry" data-glossary-text={text}>
        {children}
      </div>
    </SlateElement>
  );
}

function GlossaryTermStatic({ children, element, ...props }: SlateElementProps) {
  const text = getPlateNodeText(element as Record<string, unknown>).trim();
  const id = text ? slugifyHeading(text) : undefined;
  return (
    <SlateElement element={element} {...props}>
      <dt id={id} className="scroll-mt-48 font-semibold text-foreground">
        {children}
      </dt>
    </SlateElement>
  );
}

function GlossaryDefinitionStatic({ children, element, ...props }: SlateElementProps) {
  // No margin — the entry's flex/grid gap handles term→definition spacing.
  return (
    <SlateElement element={element} {...props}>
      <dd className="text-foreground/80">{children}</dd>
    </SlateElement>
  );
}

// Algolia path: render the container + entry as bare fragments so the term
// and definition land at body.children level, where parseHtmlIntoSections
// splits on them. The term becomes an <h4> (its own section), the definition
// a <p> (the section's content). No indexer change needed — same dual-map
// trick as AlgoliaH2Static.

function GlossaryFragmentStatic({ children }: SlateElementProps) {
  return <>{children}</>;
}
function GlossaryTermAlgoliaStatic(props: SlateElementProps) {
  return <SlateElement {...props} as="h4" />;
}
function GlossaryDefinitionAlgoliaStatic(props: SlateElementProps) {
  return <SlateElement {...props} as="p" />;
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

/**
 * toggle_v2 is the container-shape toggle. JSON is
 * `{ type: "toggle_v2", children: [{type: "toggle_v2_summary"}, ...body blocks] }`.
 * The legacy indent-based `toggle` plugin was retired in the cutover PR;
 * all stored articles use this shape (converted via
 * scripts/convert-stored-toggles.ts before the cutover).
 */
const BaseToggleV2Plugin = createSlatePlugin({
  key: "toggle_v2",
  node: { isElement: true },
});

const BaseToggleV2SummaryPlugin = createSlatePlugin({
  key: "toggle_v2_summary",
  node: { isElement: true },
});

const BaseResourceGridPlugin = createSlatePlugin({
  key: "resource_grid",
  node: { isElement: true },
});

// Static-only glossary plugins (no editor transforms — the read/Algolia
// editors don't edit). The interactive transforms live in plate-glossary.ts.
const BaseGlossaryStaticPlugin = createSlatePlugin({ key: "glossary", node: { isElement: true } });
const BaseGlossaryEntryStaticPlugin = createSlatePlugin({ key: "glossary_entry", node: { isElement: true } });
const BaseGlossaryTermStaticPlugin = createSlatePlugin({ key: "glossary_term", node: { isElement: true } });
const BaseGlossaryDefinitionStaticPlugin = createSlatePlugin({ key: "glossary_definition", node: { isElement: true } });

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
  BaseToggleV2Plugin,
  BaseToggleV2SummaryPlugin,
  BaseResourceGridPlugin,
  BaseGlossaryStaticPlugin,
  BaseGlossaryEntryStaticPlugin,
  BaseGlossaryTermStaticPlugin,
  BaseGlossaryDefinitionStaticPlugin,
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
  toggle_v2: ToggleStatic,
  img: ImageStatic,
  media_embed: MediaEmbedStatic,
  file: FileStatic,
  resource_grid: ResourceGrid,
  toggle_v2_summary: ToggleSummaryStatic,
  glossary: GlossaryStatic,
  glossary_entry: GlossaryEntryStatic,
  glossary_term: GlossaryTermStatic,
  glossary_definition: GlossaryDefinitionStatic,
  bold: BoldStatic,
  italic: ItalicStatic,
  underline: UnderlineStatic,
  strikethrough: StrikethroughStatic,
};

/**
 * Static components for the Algolia HTML serialisation path. Headings render
 * as top-level elements (no SlateElement wrapper div) so parseHtmlIntoSections
 * can split on them. All other element renderers stay identical to the
 * browser path.
 */
const staticComponentsAlgolia = {
  ...staticComponents,
  h1: AlgoliaH1Static,
  h2: AlgoliaH2Static,
  h3: AlgoliaH3Static,
  h4: AlgoliaH4Static,
  // Fragments collapse the container + entry wrappers so each term surfaces
  // as a top-level <h4> + <p> pair for parseHtmlIntoSections.
  glossary: GlossaryFragmentStatic,
  glossary_entry: GlossaryFragmentStatic,
  glossary_term: GlossaryTermAlgoliaStatic,
  glossary_definition: GlossaryDefinitionAlgoliaStatic,
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
 *
 * Headings inside a toggle body still receive an `id` (so deep links via
 * `#slug` continue to work) but they are NOT pushed to the returned
 * headings array — the TOC shows only what's reachable without first
 * expanding a collapsed toggle. Worked example: new-staff-info has an H4
 * "Set preferences for all your calendars" inside the "Set your Calendar
 * event notifications" toggle; the TOC entry would scroll to a heading
 * the reader can't see until they expand the toggle.
 */
export function addHeadingIds(value: Value): {
  value: Value;
  headings: ArticleHeading[];
} {
  const deduplicate = createSlugDeduplicator();
  const headings: ArticleHeading[] = [];

  function walkAndCopy(nodes: Value[number][], insideToggle: boolean): Value[number][] {
    let changed = false;
    const result = nodes.map((node) => {
      const record = node as Record<string, unknown>;
      const type = record.type as string | undefined;
      const children = record.children as Value[number][] | undefined;

      // Recurse into children. For a toggle_v2, only the BODY (children
      // from index 1 onward) is hidden until expanded — headings there
      // should keep their `id` for deep-linking but stay out of the TOC.
      // The SUMMARY (children[0]) is always visible (it's the clickable
      // title row), so any heading nested inside it stays in the outer
      // scope — appears in the TOC as normal. Walker output puts plain
      // text in the summary, but the editor doesn't structurally prevent
      // a user from nesting a heading inside, so the rule has to honour
      // the visible/hidden split.
      let newChildren: Value[number][] | undefined;
      if (children) {
        if (type === "toggle_v2") {
          // walkAndCopy returns the input array reference when no descendant
          // changed (the `changed ? out : nodes` return guard). Slice the
          // summary + body separately, walk each, and only allocate a new
          // children array if at least one half actually changed. Without
          // this guard the unconditional `[...summary, ...body]` spread
          // would defeat the cloning-skip optimisation: every toggle's
          // parent chain would clone on every call even when no heading
          // was modified.
          const summaryNodes = children.slice(0, 1);
          const bodyNodes = children.slice(1);
          const newSummary = walkAndCopy(summaryNodes, insideToggle);
          const newBody = walkAndCopy(bodyNodes, true);
          newChildren =
            newSummary !== summaryNodes || newBody !== bodyNodes
              ? [...newSummary, ...newBody]
              : children;
        } else {
          newChildren = walkAndCopy(children, insideToggle);
        }
      }

      if (type && HEADING_TYPES.has(type)) {
        const text = getPlateNodeText(record).trim();
        if (text) {
          const slug = deduplicate(text);
          if (!insideToggle) {
            headings.push({ text, slug, level: HEADING_LEVEL[type] });
          }
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

  return {
    value: walkAndCopy(value as Value[number][], false) as Value,
    headings,
  };
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
  return createStaticEditor({
    plugins: staticPlugins,
    value,
    override: {
      components: staticComponentsAlgolia,
    },
  });
}

/**
 * Stamp a deterministic `id` property on every element node, derived from
 * its index path in the tree. Plate's static renderer otherwise generates
 * random ids each render (server + client get different values), producing
 * hydration warnings. With ids pre-stamped, server and client renders agree.
 *
 * Text leaves (no `type` field) are skipped. Existing ids are preserved so
 * heading slugs from addHeadingIds (which double as URL anchors) are kept.
 */
function addStableNodeIds(value: Value): Value {
  function walk(nodes: Value[number][], path: string): Value[number][] {
    let changed = false;
    const out = nodes.map((node, i) => {
      const record = node as Record<string, unknown>;
      const nodePath = path ? `${path}-${i}` : `${i}`;
      // Skip text leaves and any record without a `type` field
      if (typeof record.type !== "string") return node;

      const existingId = record.id as string | undefined;
      const children = record.children as Value[number][] | undefined;
      const newChildren = children ? walk(children, nodePath) : undefined;
      const needsId = !existingId;
      const childrenChanged = newChildren && newChildren !== children;

      if (!needsId && !childrenChanged) return node;
      changed = true;
      return {
        ...record,
        ...(needsId ? { id: `n${nodePath}` } : {}),
        ...(newChildren ? { children: newChildren } : {}),
      } as Value[number];
    });
    return changed ? out : nodes;
  }
  return walk(value as Value[number][], "") as Value;
}

/**
 * Prepare a native article for rendering with heading IDs and TOC data.
 * Chains addHeadingIds → addStableNodeIds → createStaticEditor.
 *
 * Used by NativeArticleView — returns both the editor and extracted
 * headings for the TOC sidebar. Heading slugs are guaranteed to match
 * the DOM heading IDs since both come from the same walk.
 */
export function prepareNativeArticle(value: Value): {
  editor: ReturnType<typeof createStaticEditor>;
  headings: ArticleHeading[];
} {
  const { value: processed, headings } = addHeadingIds(value);
  const grouped = groupResourceGrids(processed);
  const withStableIds = addStableNodeIds(grouped);

  const editor = createStaticEditor({
    plugins: staticPlugins,
    value: withStableIds,
    override: {
      components: staticComponents,
    },
  });

  return { editor, headings };
}
