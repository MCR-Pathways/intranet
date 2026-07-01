/**
 * Resource grid — detection + type resolution for §2.
 *
 * A resource cell is a `file` void node, or a paragraph whose only meaningful
 * child is a single link. The read path groups runs of 4+ into a `resource_grid`
 * (see plate-static-plugins.tsx). This module holds the pure logic so it's
 * shared by the read view and the editor hint, and unit-tested in isolation.
 */

import {
  FileText,
  Table2,
  Presentation,
  ClipboardList,
  HardDrive,
  Link2,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import type { Value } from "platejs";
import { resolveFileType } from "./file-types";
import { APP_ORIGIN } from "./article-constants";

export interface ResourceTypeConfig {
  key: string;
  label: string;
  Icon: LucideIcon;
}

// One icon per type. The chip renders a uniform muted treatment (see ResourceGrid),
// so type is signalled by the glyph shape, not colour. Per-type colour was tried and
// pulled: on real hub pages nearly every resource is the same type, so it read as a
// wall of identical loud chips rather than useful signal.
const GDOC: ResourceTypeConfig = { key: "gdoc", label: "Google Doc", Icon: FileText };
const GSHEET: ResourceTypeConfig = { key: "gsheet", label: "Google Sheet", Icon: Table2 };
const GSLIDES: ResourceTypeConfig = { key: "gslides", label: "Google Slides", Icon: Presentation };
const GFORM: ResourceTypeConfig = { key: "gform", label: "Google Form", Icon: ClipboardList };
const GDRIVE: ResourceTypeConfig = { key: "gdrive", label: "Google Drive", Icon: HardDrive };
const INTERNAL: ResourceTypeConfig = { key: "internal", label: "Page", Icon: Link2 };
const EXTERNAL: ResourceTypeConfig = { key: "external", label: "Link", Icon: ExternalLink };
const DOCUMENT: ResourceTypeConfig = { key: "document", label: "Document", Icon: FileText };

type Node = Record<string, unknown>;

/** Mirrors LinkStatic: a relative "/…" path or an APP_ORIGIN absolute URL is internal. */
function isInternalUrl(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  if (APP_ORIGIN) {
    try {
      return new URL(url).origin === APP_ORIGIN;
    } catch {
      /* not an absolute URL */
    }
  }
  return false;
}

/**
 * Proxied Drive files (`/api/drive-file/{id}`) are documents, not page links.
 * Matches the proxy PATH, not the substring anywhere — a foreign URL that merely
 * contains `/api/drive-file/` (e.g. `https://x.com/?f=/api/drive-file/…`) is not ours.
 */
function isProxyDocument(url: string): boolean {
  if (url.startsWith("/api/drive-file/")) return true;
  if (APP_ORIGIN) {
    try {
      const u = new URL(url);
      return u.origin === APP_ORIGIN && u.pathname.startsWith("/api/drive-file/");
    } catch {
      /* not an absolute URL */
    }
  }
  return false;
}

function classifyLink(url: string): ResourceTypeConfig {
  if (isProxyDocument(url)) return DOCUMENT;
  if (isInternalUrl(url)) return INTERNAL;
  try {
    const u = new URL(url);
    if (u.hostname === "docs.google.com") {
      if (u.pathname.startsWith("/document")) return GDOC;
      if (u.pathname.startsWith("/spreadsheets")) return GSHEET;
      if (u.pathname.startsWith("/presentation")) return GSLIDES;
      if (u.pathname.startsWith("/forms")) return GFORM;
    }
    if (u.hostname === "drive.google.com") return GDRIVE;
  } catch {
    /* relative non-internal or malformed → external */
  }
  return EXTERNAL;
}

function plateText(node: Node | null | undefined): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  const kids = node.children;
  return Array.isArray(kids) ? kids.map((k) => plateText(k as Node)).join("") : "";
}

/** The single link inside a standalone-link paragraph, or null. Exported so the
 *  editor's LinkElement can gate its "show as card" toggle on the same condition. */
export function standaloneLink(node: Node): Node | null {
  if (node.type !== "p") return null;
  // Keep any element node (so a non-link element disqualifies the paragraph) or
  // non-blank text; drop the empty text nodes Plate pads inline content with.
  const kids = ((node.children as Node[]) ?? []).filter(
    (c) => typeof c.type === "string" || (typeof c.text === "string" && c.text.trim() !== ""),
  );
  return kids.length === 1 && kids[0].type === "a" ? kids[0] : null;
}

/** A standalone-link paragraph whose inner link is explicitly flagged as a card (§2.1). */
function isFlaggedCard(node: Node): boolean {
  const link = standaloneLink(node);
  return !!link && (link as Node).displayAsCard === true;
}

export function resolveResourceType(node: Node): ResourceTypeConfig {
  if (node.type === "file") {
    return resolveFileType(node.mimeType as string | undefined, node.name as string | undefined);
  }
  const link = node.type === "a" ? node : standaloneLink(node);
  return classifyLink((link?.url as string) ?? "");
}

export function resolveResourceCell(
  node: Node,
): { name: string; href: string; newTab: boolean; config: ResourceTypeConfig } | null {
  if (node.type === "file") {
    const rawName = (node.name as string) || "Document";
    return {
      // Strip the extension, but never end up empty (a dotfile like ".env" strips to "").
      name: rawName.replace(/\.[^.]+$/, "") || rawName,
      href: (node.url as string) ?? "",
      newTab: true,
      config: resolveResourceType(node),
    };
  }
  const link = standaloneLink(node);
  if (!link) return null;
  const url = (link.url as string) ?? "";
  return {
    name: plateText(link).trim() || url,
    href: url,
    newTab: isProxyDocument(url) || !isInternalUrl(url),
    config: resolveResourceType(node),
  };
}

/** A resource cell is a `file` void node, or a standalone-link paragraph. */
export function isResourceCell(node: Node): boolean {
  if (node.type === "file") return true;
  return standaloneLink(node) !== null;
}

/** A run of this many consecutive resource cells renders as a grid. */
const MIN_GRID_RUN = 4;

/**
 * Wrap runs of MIN_GRID_RUN+ consecutive resource cells in a `resource_grid` node.
 * Below that threshold, adjacent flagged standalone links (`displayAsCard`) still
 * promote to a grid so a lone or sub-threshold card renders (§2.1). Returns a new
 * top-level array; never mutates the input (render-only).
 */
export function groupResourceGrids(value: Value): Value {
  const out: Value = [];
  let run: Value = [];
  const flush = () => {
    if (run.length === 0) return;
    if (run.length >= MIN_GRID_RUN) {
      // 4+ consecutive candidates: the whole run is a grid (auto, unchanged).
      out.push({ type: "resource_grid", children: run } as unknown as Value[number]);
    } else {
      // Below threshold: promote runs of adjacent flagged cards; emit the rest
      // as-is (an unflagged link stays inline; a file stays its own block).
      let cards: Value = [];
      const flushCards = () => {
        if (cards.length > 0) {
          out.push({ type: "resource_grid", children: cards } as unknown as Value[number]);
          cards = [];
        }
      };
      for (const node of run) {
        if (isFlaggedCard(node as Node)) cards.push(node);
        else {
          flushCards();
          out.push(node);
        }
      }
      flushCards();
    }
    run = [];
  };
  for (const node of value) {
    if (isResourceCell(node as Node)) run.push(node);
    else {
      flush();
      out.push(node);
    }
  }
  flush();
  return out;
}

/**
 * True if the value contains at least one run that would render as a grid.
 * O(N) with O(1) memory and an early return — this runs on every keystroke via
 * the editor hint, so it must not allocate the grouped tree groupResourceGrids builds.
 */
export function hasResourceGridRun(value: Value): boolean {
  let run = 0;
  for (const node of value) {
    if (isResourceCell(node as Node)) {
      run++;
      if (run >= MIN_GRID_RUN || isFlaggedCard(node as Node)) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

/**
 * §2.1b — set `displayAsCard` on the standalone-link cells inside runs of
 * MIN_GRID_RUN+ consecutive resource cells: the links that already render as an
 * auto-grid. Flagging them makes the grid survive an edit that drops the run
 * below the threshold. Only 4+ runs are touched, so today's rendering is
 * unchanged; file voids in a run are left alone (files-as-cards is v2). Returns
 * a new value (never mutates the input) and the count of links newly flagged
 * this pass — an already-flagged link is left as-is and not re-counted, so the
 * transform is idempotent.
 */
export function flagAutoGridCards(value: Value): { value: Value; flaggedCount: number } {
  let flaggedCount = 0;

  const flagCell = (node: Node): Node => {
    const link = standaloneLink(node);
    if (!link || (link as Node).displayAsCard === true) return node;
    flaggedCount++;
    return {
      ...node,
      children: (node.children as Node[]).map((child) =>
        child.type === "a" ? { ...child, displayAsCard: true } : child,
      ),
    };
  };

  const out: Value = [];
  let run: Node[] = [];
  const flush = () => {
    const isGrid = run.length >= MIN_GRID_RUN;
    for (const node of run) {
      out.push((isGrid ? flagCell(node) : node) as unknown as Value[number]);
    }
    run = [];
  };
  for (const node of value) {
    if (isResourceCell(node as Node)) run.push(node as Node);
    else {
      flush();
      out.push(node);
    }
  }
  flush();
  return { value: out, flaggedCount };
}
