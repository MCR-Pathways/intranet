/**
 * HTML → Plate (Slate) JSON walker.
 *
 * Two consumers:
 *  1. WP migration CLI (scripts/migrate-wp-page.ts) — passes an `assetMap`
 *     of WP attachment URLs → uploaded Drive file metadata so that PDFs,
 *     images, and embedded videos get rewritten to `/api/drive-file/{id}`.
 *  2. Resources editor "Import HTML" feature (via importHtmlAsPlate server
 *     action) — no asset map; external image/file URLs are kept verbatim
 *     (the user can re-host individually using the editor's upload tools).
 *
 * Element handling:
 *   h1–h4               → { type: 'h1'|'h2'|'h3'|'h4', children }
 *   p                   → { type: 'p', children }
 *                          (block-level <img>/<a> children get hoisted to siblings)
 *   ul, ol (incl. nest) → series of { type: 'p', indent, listStyleType, children }
 *                          (Plate v52+ indent-based list convention)
 *   blockquote          → { type: 'blockquote', children }
 *   hr                  → { type: 'hr', children: [{ text: '' }] }
 *   img                 → { type: 'img', url, alt, width, height, align }
 *                          (URL rewritten if in assetMap)
 *   a → PDF / doc       → { type: 'file', url, name, size } (when in assetMap)
 *   a → YouTube/Vimeo   → { type: 'media_embed', url: <embed URL>, sourceUrl }
 *   a → other           → inline { type: 'a', url, children }
 *   strong, em, u, s    → text leaves with bold/italic/underline/strikethrough marks
 *   br                  → text leaf containing '\n'
 *
 * Unknown block tags are walked transparently (children processed in place).
 * Tables are NOT supported in Bit 1 — content is preserved as a plaintext
 * paragraph and a warning is emitted.
 */
import type { Value } from "platejs";
import { parseHTML } from "linkedom";

const WP_UPLOADS_PREFIX = "https://i.mcrpathways.org/wp-content/uploads/";

/**
 * Collapse multi-character whitespace runs in a text leaf to a single space,
 * matching how browsers normalise inline HTML whitespace. WP export HTML is
 * indented with tabs + newlines for readability, but those characters render
 * as visible whitespace inside Plate's editor (where data-slate-string spans
 * preserve content verbatim for cursor mapping). Collapsing here keeps the
 * Plate JSON faithful to the rendered intent without leaking layout-breaking
 * tabs into list items and paragraphs.
 */
function normaliseInlineWhitespace(text: string): string {
  return text.replace(/[\t\n\r\f\v]+/g, " ").replace(/ {2,}/g, " ");
}

// Office formats need Drive's /preview viewer to render in a new tab —
// the browser can't render DOCX/XLSX/PPTX natively, so a plain proxy link
// would trigger a download. Each file is domain-shared during migration
// so Drive's /preview URL renders without a sign-in challenge.
const OFFICE_DOC_MIMES = new Set<string>([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function rewriteWpAnchorUrl(asset: AssetInfo): string {
  // Drive preview URL for Office docs (DOCX/XLSX/PPTX) so a new-tab click
  // shows the file in Drive's viewer instead of triggering a download.
  if (OFFICE_DOC_MIMES.has(asset.mimeType)) {
    return `https://drive.google.com/file/d/${asset.fileId}/preview`;
  }
  // Proxy URL for everything else (PDF, images, text, CSV) — browser handles
  // inline preview via its own viewers when /api/drive-file serves with
  // Content-Disposition: inline.
  return `/api/drive-file/${asset.fileId}`;
}

export interface AssetInfo {
  fileId: string;
  mimeType: string;
  fileName: string;
  size: number;
}

export interface HtmlToPlateResult {
  value: Value;
  warnings: string[];
}

/**
 * Walker options threaded through every function in the walk. Optional
 * features the migration script enables but the UI Import HTML path doesn't.
 */
export interface WalkerOptions {
  /**
   * Slugs of already-migrated Resources articles. When set, the walker
   * rewrites `https://i.mcrpathways.org/{slug}/` anchor hrefs to the
   * internal `/resources/article/{slug}` path so cross-references between
   * migrated pages don't bounce users to the (soon-retired) WP site.
   *
   * Built once per migration run by the script querying
   * `resource_articles` for `slug` where `deleted_at is null`. Set to
   * `undefined` (Import HTML path) leaves WP URLs verbatim.
   */
  internalSlugs?: Set<string>;
  /**
   * Set of hrefs that appear as text links (non-image-preview anchors)
   * somewhere in the body. Internal to the walker — populated by
   * htmlToPlate before walking. Consumed by the image-preview-anchor
   * deduplication path: when `<a href="x.pdf"><img/></a>` is encountered
   * and the same href is in this set, the preview is dropped because
   * a superior text-link surface already exists for the file.
   *
   * Using a "text-link surface exists?" set rather than a raw occurrence
   * count avoids a data-loss bug: a page with TWO image previews and NO
   * text link would have count=2 and previously have had both previews
   * dropped, orphaning the file. With this design, image-only-anchor
   * dedupe only fires when at least one text-link surface is present.
   */
  textLinkHrefs?: Set<string>;
}

const WP_PAGE_PREFIX = "https://i.mcrpathways.org/";

/**
 * Rewrite a cross-link to another WP page to its new intranet path if the
 * destination has been migrated. Only matches top-level page slugs — deeper
 * paths like `/mentor-training/sub-page/` are left alone because the deeper
 * resource might not be a migrated article (could be a sub-resource, a
 * legacy WP URL, etc.). The slug must match exactly.
 */
function rewriteInternalSlug(
  href: string,
  internalSlugs: Set<string> | undefined,
): string {
  if (!internalSlugs) return href;
  if (!href.startsWith(WP_PAGE_PREFIX)) return href;
  // Don't conflict with the more-specific WP_UPLOADS_PREFIX, which is
  // handled elsewhere by the asset-rewrite path.
  if (href.startsWith(WP_UPLOADS_PREFIX)) return href;
  // Normalise to lowercase before regex-matching. WP migration source URLs
  // are conventionally lowercase, but the walker is also used by the
  // Resources "Import HTML" feature where users paste arbitrary content
  // that may have mixed-case URLs. The regex below restricts to lowercase
  // character class; without this normalisation, a paste like
  // `https://i.mcrpathways.org/Mentor-Training/` would fall through to the
  // unrewritten branch.
  const path = href.slice(WP_PAGE_PREFIX.length).toLowerCase();
  const match = path.match(/^([a-z0-9][a-z0-9-]*)\/?$/);
  if (!match) return href;
  const slug = match[1];
  if (!internalSlugs.has(slug)) return href;
  return `/resources/article/${slug}`;
}

interface InlineMarks {
  bold?: true;
  italic?: true;
  underline?: true;
  strikethrough?: true;
}

interface TextLeaf extends InlineMarks {
  text: string;
}

interface PlateNode {
  type: string;
  children: (PlateNode | TextLeaf)[];
  [key: string]: unknown;
}

type DomNode = Element | ChildNode;

/**
 * Convert WP HTML body content into a Plate value.
 *
 * @param html - Cleaned HTML body content
 * @param assetMap - Optional WP-URL → Drive metadata map. When absent,
 *                  WP-content URLs in the input HTML are kept as-is.
 * @param options - Optional walker options (internal-slug rewriting, etc.)
 */
export function htmlToPlate(
  html: string,
  assetMap?: Map<string, AssetInfo>,
  options?: WalkerOptions,
): HtmlToPlateResult {
  const warnings: string[] = [];
  const { document } = parseHTML(
    `<!DOCTYPE html><html><body>${html}</body></html>`,
  );
  const body = document.body;
  if (!body) {
    return { value: [], warnings: ["empty body after parse"] };
  }
  // Identify which hrefs have at least one text-link surface in the body
  // (anchor with non-empty textContent — NOT an image-only preview). Used
  // by the block walker to detect when a <a href="x.pdf"><img/></a>
  // preview is redundant: if a text link to the same href exists, the
  // preview is dropped. If no text link exists, the preview is the sole
  // surface and survives.
  const textLinkHrefs = new Set<string>();
  for (const a of Array.from(body.querySelectorAll("a[href]"))) {
    const href = a.getAttribute("href");
    if (!href) continue;
    const isImageOnly =
      a.querySelectorAll("img").length > 0 &&
      (a.textContent ?? "").trim() === "";
    if (!isImageOnly) {
      textLinkHrefs.add(href);
    }
  }
  const value = walkBlocks(
    Array.from(body.childNodes) as DomNode[],
    assetMap,
    warnings,
    0,
    { ...options, textLinkHrefs },
  );
  return { value: collapseEmptyParagraphs(groupToggleBodies(value)), warnings };
}

/**
 * Strip dangerous tags + attributes from untrusted HTML before walking.
 * Use for the in-UI "Import HTML" path; WP-export migrations don't need
 * this because the XML body is org-trusted content.
 */
export function sanitiseHtmlForImport(html: string): string {
  const { document } = parseHTML(
    `<!DOCTYPE html><html><body>${html}</body></html>`,
  );
  const body = document.body;
  if (!body) return "";

  // Remove dangerous tags entirely
  for (const tag of ["script", "style", "iframe", "object", "embed", "form"]) {
    for (const el of Array.from(body.querySelectorAll(tag))) el.remove();
  }

  // Strip dangerous attributes from every element
  const walker = document.createTreeWalker(body, 1 /* NodeFilter.SHOW_ELEMENT */);
  let node = walker.nextNode();
  while (node) {
    const el = node as Element;
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === "href" || name === "src" || name === "action") && /^\s*javascript:/i.test(value)) {
        el.removeAttribute(attr.name);
        continue;
      }
    }
    node = walker.nextNode();
  }

  return body.innerHTML;
}

// =============================================
// BLOCK WALKER
// =============================================

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4"]);

/**
 * Detect an anchor that's acting as a navigation marker rather than a real
 * link. WP page authors and Elementor's Toggle/Tab widgets both produce
 * structurally-similar HTML for "this is the start of a section":
 *
 *   <a name="section-slug"></a>       — WP page-anchor jump target
 *   <a name="x">Section name</a>      — WP page-anchor with visible label
 *   <a class="elementor-toggle-title">Title</a>  — Elementor Toggle title
 *   <a class="elementor-tab-title" href="#">…</a> — Elementor Tab title
 *
 * None of these are real links the reader should click. In a flat-Plate
 * migration they become orphan inline anchors that visually masquerade as
 * cross-reference links — see memory/wp-migration-design-audit.md for the
 * pages where this was severe (group-work's 7 themes, new-staff-info's 16
 * step titles, pc-support's "PC Guidebook").
 */
/**
 * Detect the Elementor accordion widget title pattern specifically:
 * `<a tabindex="0">Title</a>` with NO href attribute. The toggle's
 * click interactivity is supplied by Elementor's JS at runtime; the
 * static HTML has just an anchor with a focus index. Verified on
 * information-for-new-staff's WP source.
 *
 * Distinguished from generic navigation-marker anchors so the walker
 * can emit a Plate `toggle` block (collapsible accordion in the read
 * view) rather than a flat heading. Matches the OLD intranet's
 * collapsible step-by-step UX.
 */
function isToggleTitleAnchor(el: Element): boolean {
  if (el.getAttribute("href") !== null) return false;
  if (!el.hasAttribute("tabindex")) return false;
  return true;
}

function isNavigationMarkerAnchor(el: Element): boolean {
  // Toggle titles are handled separately (they emit a `toggle` block,
  // not a heading); exclude them here.
  if (isToggleTitleAnchor(el)) return false;
  const href = el.getAttribute("href");
  // No href attribute at all (and no tabindex — that's a toggle, handled
  // above) → bare anchor with no link target, treat as section marker.
  if (href === null) return true;
  const hrefIsEmpty = href === "" || href === "#";
  if (!hrefIsEmpty) return false;
  if (el.hasAttribute("name")) return true;
  const className = el.getAttribute("class") ?? "";
  if (/\btoggle-title\b|\btab-title\b/i.test(className)) return true;
  return false;
}

/**
 * Find the most recent heading level already emitted into `out` so that an
 * orphan navigation-marker promoted to a heading lands at the right depth.
 *
 * - No prior heading → level 1 (so the orphan becomes H2 — a top-level
 *   section, peer of where the page-title H1 would be).
 * - Previous H2 → orphan becomes H3 (group-work themes case).
 * - Previous H3 → orphan becomes H4 (new-staff-info step titles).
 *
 * Capped at H6.
 */
function findMostRecentHeadingLevel(out: PlateNode[]): number {
  for (let i = out.length - 1; i >= 0; i--) {
    const match = /^h([1-6])$/.exec(out[i].type);
    if (match) return parseInt(match[1], 10);
  }
  return 1;
}

const TRANSPARENT_WRAPPER_TAGS = new Set([
  "div",
  "section",
  "article",
  "main",
  "figure",
  "figcaption",
  "header",
  "footer",
  "aside",
]);

function walkBlocks(
  nodes: DomNode[],
  assetMap: Map<string, AssetInfo> | undefined,
  warnings: string[],
  indent: number,
  options?: WalkerOptions,
): PlateNode[] {
  const out: PlateNode[] = [];
  for (const node of nodes) {
    appendBlocks(node, assetMap, warnings, indent, out, options);
  }
  return out;
}

function appendBlocks(
  node: DomNode,
  assetMap: Map<string, AssetInfo> | undefined,
  warnings: string[],
  indent: number,
  out: PlateNode[],
  options?: WalkerOptions,
): void {
  if (node.nodeType === 3) {
    const text = node.textContent ?? "";
    if (text.trim()) {
      out.push({ type: "p", children: [{ text }] });
    }
    return;
  }
  if (node.nodeType !== 1) return;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (HEADING_TAGS.has(tag)) {
    // Demote in-body H1 to H2. The page-title H1 is supplied by the article
    // view's chrome (NativeArticleView, GoogleDocArticleView); any H1 inside
    // body content creates a second H1 in the accessibility tree. HTML5
    // and WAI-ARIA expect exactly one H1 per page. WP page authors sometimes
    // put an H1 inside the body when they intended a section title — promote
    // to H2 instead of preserving the regression.
    const headingType = tag === "h1" ? "h2" : tag;
    out.push({
      type: headingType,
      children: walkInline(Array.from(el.childNodes) as DomNode[], assetMap, warnings, {}, options),
    });
    return;
  }

  if (tag === "p") {
    const paraNodes = walkInline(Array.from(el.childNodes) as DomNode[], assetMap, warnings, {}, options);
    const blocks: PlateNode[] = [];
    const inline: (PlateNode | TextLeaf)[] = [];
    for (const n of paraNodes) {
      if (isBlockHoist(n)) blocks.push(n as PlateNode);
      else inline.push(n);
    }
    if (blocks.length && hasOnlyEmptyText(inline)) {
      out.push(...blocks);
    } else if (blocks.length) {
      if (inline.length) out.push({ type: "p", children: inline });
      out.push(...blocks);
    } else if (inline.length) {
      out.push({ type: "p", children: inline });
    }
    return;
  }

  if (tag === "ul" || tag === "ol") {
    walkList(
      el,
      assetMap,
      warnings,
      indent + 1,
      tag === "ol" ? "decimal" : "disc",
      out,
      options,
    );
    return;
  }

  if (tag === "blockquote") {
    const children = walkBlocks(
      Array.from(el.childNodes) as DomNode[],
      assetMap,
      warnings,
      indent,
      options,
    );
    out.push({
      type: "blockquote",
      children: children.length
        ? children
        : [{ type: "p", children: [{ text: "" }] }],
    });
    return;
  }

  if (tag === "hr") {
    out.push({ type: "hr", children: [{ text: "" }] });
    return;
  }

  if (tag === "img") {
    const imgNode = buildImgNode(el, assetMap, warnings);
    if (imgNode) out.push(imgNode);
    return;
  }

  if (tag === "a") {
    // Elementor accordion widget title — emit a Plate `toggle` block so
    // the read-view renders as a collapsible accordion (matches the OLD
    // intranet UX where users click a step title to expand its content).
    // Following content (until the next toggle title or a heading at
    // the surrounding scope) gets indented as toggle body children by
    // the indentToggleBodies post-process.
    if (isToggleTitleAnchor(el)) {
      const text = (el.textContent ?? "").trim();
      if (text) {
        out.push({ type: "toggle", children: [{ text }] });
      }
      return;
    }
    // Navigation-marker anchors (WP jump-anchors, Elementor Toggle/Tab
    // widgets with `name` attribute or `toggle-title` class) end up at
    // block level after the surrounding <div>s walk transparently. They
    // were intended as section headers by the WP author; promote to a
    // heading at the depth-context appropriate level.
    if (isNavigationMarkerAnchor(el)) {
      const text = (el.textContent ?? "").trim();
      if (text) {
        const level = Math.min(findMostRecentHeadingLevel(out) + 1, 6);
        out.push({
          type: `h${level}`,
          children: [{ text }],
        });
      }
      return;
    }

    // Clickable-image-preview pattern: <a href="x.pdf"><img src="..."></a>.
    // The author wrapped an image in an anchor so clicking the visual
    // preview opens the PDF. WP authors commonly emit BOTH this form AND
    // a text-link reference to the same file in a bullet list nearby —
    // two surfaces for one file. The walker's pre-pass populated
    // hrefCounts so we can detect the duplicate and drop the preview
    // anchor entirely (the text-link surface elsewhere serves the click
    // action and is visually cleaner). If the href has only ONE
    // occurrence in the body, this anchor IS the only surface; preserve
    // the image as a non-clickable visual (Plate's <img> node has no
    // linkTarget; rebuilding click-through requires a separate node-spec
    // change, tracked elsewhere).
    const href = el.getAttribute("href") ?? "";
    const imgChildren = Array.from(el.querySelectorAll("img"));
    const hasOnlyImage = imgChildren.length > 0
      && (el.textContent ?? "").trim() === "";
    if (hasOnlyImage) {
      const hasTextLinkSurface = options?.textLinkHrefs?.has(href) ?? false;
      if (hasTextLinkSurface) {
        // A text-link surface for this file already exists elsewhere on
        // the page — drop the redundant image preview. Surface as a
        // warning for the migration log.
        warnings.push(
          `Dropped duplicate image-preview anchor for ${href} — file is also linked as text elsewhere on the page.`,
        );
        return;
      }
      // Sole surface for this file — keep the image as a visual preview.
      // Click affordance is lost (img has no linkTarget) but the file is
      // still reachable via the asset map. Operators can edit if they
      // want to restore an explicit text link.
      for (const imgEl of imgChildren) {
        const imgNode = buildImgNode(imgEl, assetMap, warnings);
        if (imgNode) out.push(imgNode);
      }
      return;
    }

    const fileOrEmbed = buildLinkBlock(el, assetMap);
    if (fileOrEmbed) {
      out.push(fileOrEmbed);
    } else {
      out.push({
        type: "p",
        children: walkInline([el], assetMap, warnings, {}, options),
      });
    }
    return;
  }

  if (tag === "br") return;

  if (TRANSPARENT_WRAPPER_TAGS.has(tag)) {
    for (const child of Array.from(el.childNodes) as DomNode[]) {
      appendBlocks(child, assetMap, warnings, indent, out, options);
    }
    return;
  }

  if (tag === "table") {
    warnings.push(
      "Table element encountered — not handled in Bit 1; content preserved as plaintext paragraph.",
    );
    const text = (el.textContent ?? "").trim();
    if (text) out.push({ type: "p", children: [{ text }] });
    return;
  }

  warnings.push(`Unknown block tag <${tag}> — walking transparently.`);
  for (const child of Array.from(el.childNodes) as DomNode[]) {
    appendBlocks(child, assetMap, warnings, indent, out, options);
  }
}

function isBlockHoist(n: PlateNode | TextLeaf): boolean {
  if (!("type" in n)) return false;
  return n.type === "img" || n.type === "file" || n.type === "media_embed";
}

// =============================================
// LIST HANDLER
// =============================================

function walkList(
  listEl: Element,
  assetMap: Map<string, AssetInfo> | undefined,
  warnings: string[],
  indent: number,
  listStyleType: "disc" | "decimal",
  out: PlateNode[],
  options?: WalkerOptions,
): void {
  // Plate's BaseListPlugin wraps each list-styled paragraph in its OWN
  // <ol>/<ul> via a `belowNodes` render hook, then uses `listStart` to set
  // <ol start="N">. The interactive editor's `normalizeListStart` keeps
  // these numbers in sync as the user types, but migrated content lands
  // pre-built and is never normalised — so without listStart every <ol>
  // defaults to start=1 and every numbered item visually reads "1.".
  // Compute the position here so the rendered numbering is correct.
  // Unordered lists don't need listStart (HTML's `start` attr is <ol>-only).
  const isOrdered = listStyleType === "decimal";
  let listIndex = 1;
  if (isOrdered) {
    const startAttr = listEl.getAttribute("start");
    if (startAttr) {
      const parsed = parseInt(startAttr, 10);
      if (Number.isFinite(parsed) && parsed > 0) listIndex = parsed;
    }
  }

  for (const child of Array.from(listEl.childNodes)) {
    if (child.nodeType !== 1) continue;
    const childEl = child as Element;
    if (childEl.tagName.toLowerCase() !== "li") continue;

    const directInline: DomNode[] = [];
    const nestedLists: { el: Element; type: "ul" | "ol" }[] = [];
    for (const sub of Array.from(childEl.childNodes)) {
      if (sub.nodeType === 1) {
        const subEl = sub as Element;
        const subTag = subEl.tagName.toLowerCase();
        if (subTag === "ul" || subTag === "ol") {
          nestedLists.push({ el: subEl, type: subTag });
          continue;
        }
      }
      directInline.push(sub as DomNode);
    }

    const rawInlineChildren = walkInline(directInline, assetMap, warnings, {}, options);

    // Trim pure-whitespace text leaves at the start and end of a list item,
    // matching the HTML rendering rule that collapses whitespace at block
    // boundaries. Without this, indented WP markup like
    //   <li>\n\t\t<a href=...>X</a>\n\t</li>
    // leaks visible tabs/newlines around the link in Plate's editor view
    // (where data-slate-string spans preserve content verbatim).
    const inlineChildren = trimEdgeWhitespaceLeaves(rawInlineChildren);

    // Plate static renderer doesn't render void blocks (file/img/media_embed)
    // inside list-styled paragraphs — they collapse to empty bullets. Hoist
    // them out: emit the void blocks at the current block scope, prefixed
    // by the list paragraph if there's accompanying real inline text.
    const voidBlocks: PlateNode[] = [];
    const realInline: (PlateNode | TextLeaf)[] = [];
    for (const n of inlineChildren) {
      if (isBlockHoist(n)) voidBlocks.push(n as PlateNode);
      else realInline.push(n);
    }
    const hasRealText = realInline.some(
      (n) => isTextLeaf(n) && n.text.trim() !== "",
    ) || realInline.some((n) => !isTextLeaf(n)); // inline links count

    if (voidBlocks.length && !hasRealText) {
      // Pure-void list item — emit only the blocks, no bullet wrapper.
      // No marker is displayed, so don't advance the counter; the next
      // bulleted item picks up where the previous one left off.
      out.push(...voidBlocks);
    } else if (voidBlocks.length) {
      // Mixed: bullet for the real inline content, blocks as siblings beneath
      out.push({
        type: "p",
        indent,
        listStyleType,
        ...(isOrdered ? { listStart: listIndex } : {}),
        children: realInline.length ? realInline : [{ text: "" }],
      });
      out.push(...voidBlocks);
      if (isOrdered) listIndex++;
    } else {
      out.push({
        type: "p",
        indent,
        listStyleType,
        ...(isOrdered ? { listStart: listIndex } : {}),
        children: inlineChildren.length ? inlineChildren : [{ text: "" }],
      });
      if (isOrdered) listIndex++;
    }

    for (const nested of nestedLists) {
      walkList(
        nested.el,
        assetMap,
        warnings,
        indent + 1,
        nested.type === "ol" ? "decimal" : "disc",
        out,
        options,
      );
    }
  }
}

// =============================================
// INLINE WALKER
// =============================================

const INLINE_MARK_TAGS: Record<string, InlineMarks> = {
  strong: { bold: true },
  b: { bold: true },
  em: { italic: true },
  i: { italic: true },
  u: { underline: true },
  s: { strikethrough: true },
  strike: { strikethrough: true },
  del: { strikethrough: true },
};

function walkInline(
  nodes: DomNode[],
  assetMap: Map<string, AssetInfo> | undefined,
  warnings: string[],
  marks: InlineMarks = {},
  options?: WalkerOptions,
): (PlateNode | TextLeaf)[] {
  const out: (PlateNode | TextLeaf)[] = [];
  for (const node of nodes) {
    if (node.nodeType === 3) {
      const text = normaliseInlineWhitespace(node.textContent ?? "");
      if (text) out.push({ text, ...marks });
      continue;
    }
    if (node.nodeType !== 1) continue;

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (INLINE_MARK_TAGS[tag]) {
      const merged = { ...marks, ...INLINE_MARK_TAGS[tag] };
      out.push(
        ...walkInline(
          Array.from(el.childNodes) as DomNode[],
          assetMap,
          warnings,
          merged,
          options,
        ),
      );
      continue;
    }

    if (tag === "br") {
      out.push({ text: "\n", ...marks });
      continue;
    }

    if (tag === "a") {
      // Navigation-marker anchors inline (e.g. WP's
      // `<p><a name="bookmark"></a>Term</p>` pattern) carry no link target.
      // Drop the wrapping anchor; emit any inline children at the same
      // level. Empty-children anchors contribute nothing and disappear.
      // Block-level promotion to a heading happens in appendBlocks; inline
      // context (this branch) deliberately stays inline because the
      // surrounding <p> may have other meaningful content.
      if (isNavigationMarkerAnchor(el)) {
        const children = walkInline(
          Array.from(el.childNodes) as DomNode[],
          assetMap,
          warnings,
          marks,
          options,
        );
        if (children.length) out.push(...children);
        continue;
      }

      const href = el.getAttribute("href") ?? "";

      // WP-uploaded asset → rewrite URL to point at our Drive (or Drive's
      // own /preview for Office docs). Videos become inline media_embed
      // blocks; everything else stays as a plain <a> inline link inside
      // the surrounding paragraph/list — same UX as external links so a
      // bulleted list of docs renders as a compact list of hyperlinks.
      if (href.startsWith(WP_UPLOADS_PREFIX)) {
        const asset = assetMap?.get(href);
        if (asset) {
          const videoEmbed = buildVideoEmbedFromAnchor(href, asset);
          if (videoEmbed) {
            out.push(videoEmbed);
            continue;
          }
          const linkText = (el.textContent ?? "").trim();
          if (!linkText) {
            // Anchor had no inner text content — walker falls back to the
            // asset's raw filename as visible text. That's usually not what
            // the author intended (most cases are <a><img/></a> where the
            // image got dropped, or empty <a></a> from accidental
            // double-linking in WP). Surface as a warning so the operator
            // can clean up in the editor post-migration or fix in WP source
            // before re-migration.
            warnings.push(
              `Anchor filename fallback for ${asset.fileName} — empty <a> in WP source, visible text is the raw filename. Consider editorial cleanup.`,
            );
          }
          out.push({
            type: "a",
            url: rewriteWpAnchorUrl(asset),
            children: [{ text: linkText || asset.fileName, ...marks }],
          });
          continue;
        }
        if (assetMap) {
          warnings.push(`Anchor href not in asset map: ${href}`);
        }
        // No asset entry — fall through to a plain link with the WP URL
        // (which will 404 once WP retires; the warning surfaces it).
      }

      // External video (YouTube/Vimeo) → inline media_embed iframe.
      const embedBlock = buildEmbedBlockFromAnchor(el, href);
      if (embedBlock) {
        out.push(embedBlock);
        continue;
      }

      // Plain external link. Rewrite known-internal cross-references
      // to the new intranet's /resources/article/<slug> path so users
      // don't bounce to the (soon-retired) WP site. No-op if the
      // walker wasn't given an internalSlugs set, or if the slug
      // isn't in the migrated list.
      const rewrittenHref = rewriteInternalSlug(href, options?.internalSlugs);
      const linkText = (el.textContent ?? "").trim();
      out.push({
        type: "a",
        url: rewrittenHref,
        children: [{ text: linkText || rewrittenHref, ...marks }],
      });
      continue;
    }

    if (tag === "img") {
      const imgNode = buildImgNode(el, assetMap, warnings);
      if (imgNode) out.push(imgNode);
      continue;
    }

    out.push(
      ...walkInline(
        Array.from(el.childNodes) as DomNode[],
        assetMap,
        warnings,
        marks,
        options,
      ),
    );
  }
  return out;
}

// =============================================
// NODE BUILDERS
// =============================================

function buildImgNode(
  el: Element,
  assetMap: Map<string, AssetInfo> | undefined,
  warnings: string[],
): PlateNode | null {
  const src = el.getAttribute("src") ?? "";
  if (!src) return null;

  let url = src;
  if (src.startsWith(WP_UPLOADS_PREFIX)) {
    const asset = assetMap?.get(src);
    if (asset) {
      url = `/api/drive-file/${asset.fileId}`;
    } else if (assetMap) {
      // Migration path with a present map but a missing entry — defensive
      warnings.push(`Image src not in asset map: ${src}`);
      return null;
    }
    // No assetMap: keep original WP URL (UI import scenario)
  }

  const alt = el.getAttribute("alt") ?? "";
  const width = parseDimension(el.getAttribute("width"));
  const height = parseDimension(el.getAttribute("height"));

  return {
    type: "img",
    url,
    alt,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    align: "center",
    children: [{ text: "" }],
  };
}

function buildLinkBlock(
  el: Element,
  assetMap: Map<string, AssetInfo> | undefined,
): PlateNode | null {
  const href = el.getAttribute("href") ?? "";
  // Block-level <a> at the document root — only emit a block node for video
  // embeds (MCR-hosted MP4 or YouTube/Vimeo). For document links, fall
  // through and let the caller wrap them in a paragraph so they render as
  // inline links matching the bullet-list UX.
  if (href.startsWith(WP_UPLOADS_PREFIX)) {
    const asset = assetMap?.get(href);
    const video = buildVideoEmbedFromAnchor(href, asset);
    if (video) return video;
  }
  return buildEmbedBlockFromAnchor(el, href);
}

function buildVideoEmbedFromAnchor(
  href: string,
  asset: AssetInfo | undefined,
): PlateNode | null {
  if (!asset) return null;
  if (!asset.mimeType.startsWith("video/")) return null;
  return {
    type: "media_embed",
    url: `/api/drive-file/${asset.fileId}`,
    sourceUrl: href,
    children: [{ text: "" }],
  };
}

function buildEmbedBlockFromAnchor(el: Element, href: string): PlateNode | null {
  const embedUrl = toEmbedUrl(href);
  if (!embedUrl) return null;
  return {
    type: "media_embed",
    url: embedUrl,
    sourceUrl: href,
    children: [{ text: "" }],
  };
}

// =============================================
// VIDEO URL → EMBED URL
// =============================================

/** Convert YouTube / Vimeo watch URLs into their inline embed equivalent. */
export function toEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtube.com" && u.pathname === "/watch") {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "youtube.com" && u.pathname.startsWith("/embed/")) {
      return url;
    }
    if (host === "vimeo.com") {
      const segments = u.pathname.split("/").filter(Boolean);
      const id = segments[segments.length - 1];
      if (id && /^\d+$/.test(id)) {
        return `https://player.vimeo.com/video/${id}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================
// HELPERS
// =============================================

function parseDimension(v: string | null): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isTextLeaf(n: PlateNode | TextLeaf): n is TextLeaf {
  return typeof (n as TextLeaf).text === "string" && !("type" in n);
}

/**
 * Drop pure-whitespace text leaves at the start and end of a children list.
 * Used at block boundaries (list items, paragraphs) where HTML indentation
 * leaks tabs/newlines into the Plate JSON.
 */
function trimEdgeWhitespaceLeaves(
  nodes: (PlateNode | TextLeaf)[],
): (PlateNode | TextLeaf)[] {
  let start = 0;
  let end = nodes.length;
  while (start < end && isTextLeaf(nodes[start]) && (nodes[start] as TextLeaf).text.trim() === "") {
    start++;
  }
  while (end > start && isTextLeaf(nodes[end - 1]) && (nodes[end - 1] as TextLeaf).text.trim() === "") {
    end--;
  }
  return start === 0 && end === nodes.length ? nodes : nodes.slice(start, end);
}

function hasOnlyEmptyText(nodes: (PlateNode | TextLeaf)[]): boolean {
  return nodes.every((n) => isTextLeaf(n) && n.text.trim() === "");
}

/**
 * Walk the flat output and indent blocks that follow a toggle title so
 * they render as that toggle's body children. Plate's TogglePlugin uses
 * an indent-based sibling model (see resources/CLAUDE.md): the static
 * renderer's `nestToggleChildren` converts higher-indent siblings into
 * `<details>` body content under the preceding `<summary>` title.
 *
 * Scope rules (parent-heading-aware):
 * - When a toggle opens, record the most recent heading level as the
 *   toggle's "parent level."
 * - Subsequent non-heading blocks get `indent + 1` (toggle body
 *   siblings).
 * - Another toggle opens its own scope (closing the previous one).
 * - A heading DEEPER than the parent level stays INSIDE the toggle
 *   body (it's a sub-heading of the toggle's procedure). Verified
 *   on information-for-new-staff: `<a tabindex="0">Set your Calendar
 *   event notifications</a>` followed by `<h4>Set preferences for
 *   all your calendars</h4>` — the H4 is inside the toggle body in
 *   the OLD intranet's Elementor `.elementor-tab-content`.
 * - A heading at the parent level OR shallower closes the toggle
 *   scope. This is the "back to a sibling/parent section" signal.
 */
/**
 * Group the walker's flat output into container-shape toggle_v2 nodes.
 *
 * Walker emits a flat sequence with `{ type: "toggle", children: [{ text }] }`
 * markers and body siblings interleaved (the old shape consumed by the
 * legacy indent-based `BaseTogglePlugin`). This pass turns each toggle
 * marker + its scope-bounded body into:
 *
 *   { type: "toggle_v2", children: [
 *       { type: "toggle_v2_summary", children: titleChildren },
 *       ...bodyChildren
 *   ] }
 *
 * Scope rule matches the old `indentToggleBodies` exactly:
 *
 * - Body extends from the toggle marker forward until a closer is hit.
 * - Closers: next sibling `toggle` marker (WP Elementor's
 *   `.elementor-toggle-item` is a flat list of accordion items, never
 *   nested), or a heading at the surrounding parent level or shallower.
 * - Headings DEEPER than `toggleParentLevel` stay inside the body —
 *   AND they update the outer `mostRecentHeadingLevel`, so a subsequent
 *   sibling toggle inherits the deeper level as its own parent. Mirrors
 *   the legacy single-pass behaviour where an in-body H4 bumped the
 *   tracker and the next toggle in the same section had `parent: 4`.
 *
 * After the top-level pass, the function walks any container children
 * recursively. For the WP migration's current content set (verified: 0
 * nested-in-container toggle markers across 9 native articles, all 17
 * markers top-level in information-for-new-staff), this is defensive
 * code with no effect. It future-proofs against content sources where a
 * toggle title anchor might end up inside a `<blockquote>`, `<column>`,
 * or other container — `appendBlocks` recurses into those via
 * `walkBlocks(childNodes)` with a fresh `out` array, so an in-blockquote
 * `<a tabindex="0">` would land nested. The top-level pass alone
 * wouldn't touch it; the recursive descent here does.
 */
function groupToggleBodies(nodes: PlateNode[]): PlateNode[] {
  const result: PlateNode[] = [];
  let i = 0;
  let mostRecentHeadingLevel = 0;

  while (i < nodes.length) {
    const node = nodes[i];
    const headingMatch = /^h([1-6])$/.exec(node.type);
    const headingLevel = headingMatch ? parseInt(headingMatch[1], 10) : 0;

    if (node.type === "toggle") {
      const toggleParentLevel = mostRecentHeadingLevel;
      const titleChildren = (node as { children?: PlateNode[] }).children ?? [
        { text: "" },
      ];
      const bodySlice: PlateNode[] = [];
      i++;

      while (i < nodes.length) {
        const next = nodes[i];

        // A sibling toggle marker starts a new accordion item at the same
        // parent level — the WP Elementor pattern is a flat list of
        // `.elementor-toggle-item` siblings, not nested toggles. Stop
        // collecting so this toggle's body ends here and the next one
        // becomes a sibling.
        if (next.type === "toggle") break;

        const nextHeadingMatch = /^h([1-6])$/.exec(next.type);
        const nextHeadingLevel = nextHeadingMatch
          ? parseInt(nextHeadingMatch[1], 10)
          : 0;

        // Heading at the parent level or shallower closes this toggle.
        if (nextHeadingLevel > 0 && nextHeadingLevel <= toggleParentLevel) {
          break;
        }

        bodySlice.push(next);
        // Mirror legacy `indentToggleBodies` semantics: an in-body
        // sub-heading bumps the outer-scope's most-recent-heading
        // tracker, so a subsequent sibling toggle inherits the
        // sub-heading's level as its own `toggleParentLevel`. Without
        // this, after `[h3, toggle A, h4-in-body, toggle B, h4]` the
        // trailing h4 wouldn't close toggle B (4 > 3 keeps it in body),
        // diverging from the legacy behaviour where it does close.
        if (nextHeadingLevel > 0) {
          mostRecentHeadingLevel = nextHeadingLevel;
        }
        i++;
      }

      result.push({
        type: "toggle_v2",
        children: [
          { type: "toggle_v2_summary", children: titleChildren },
          ...bodySlice,
        ],
      } as PlateNode);
    } else {
      if (headingLevel > 0) mostRecentHeadingLevel = headingLevel;
      result.push(node);
      i++;
    }
  }

  // Recurse into block-level children of any container in the result so a
  // toggle marker that landed nested inside a blockquote, column, or other
  // container also folds into a toggle_v2. No-op for already-grouped
  // toggle_v2 children (which contain summary + body, no markers).
  return result.map((node) => {
    const children = (node as { children?: unknown }).children;
    if (!Array.isArray(children)) return node;
    return {
      ...node,
      children: groupToggleBodies(children as PlateNode[]),
    } as PlateNode;
  });
}

function collapseEmptyParagraphs(nodes: PlateNode[]): Value {
  return nodes.filter((n) => {
    if (n.type !== "p") return true;
    if (!Array.isArray(n.children)) return true;
    // Preserve list paragraphs even if visually empty.
    if (n.indent && n.listStyleType) return true;
    // A paragraph counts as content-bearing if it has either non-empty text
    // OR any inline non-text child (e.g. `<a>` link element). The earlier
    // text-only check incorrectly dropped paragraphs whose sole content was
    // an inline link — e.g. WP source `<p><a href="...pdf">Paper Form</a></p>`
    // would be filtered out, losing the link entirely. See participation-forms
    // for the original case that surfaced this.
    return n.children.some((c) => {
      if (isTextLeaf(c)) return c.text.trim().length > 0;
      return true;
    });
  }) as Value;
}
