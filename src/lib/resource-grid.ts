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
  bgClass: string;
  fgClass: string;
}

// Link type configs. This is the Tailwind type-colour convention — file-types.ts
// already uses non-brand red/blue/green/orange/slate for file types, so the chip
// palette is an established convention, not app chrome.
const GDOC: ResourceTypeConfig = { key: "gdoc", label: "Google Doc", Icon: FileText, bgClass: "bg-blue-50 dark:bg-blue-950/30", fgClass: "text-blue-700 dark:text-blue-400" };
const GSHEET: ResourceTypeConfig = { key: "gsheet", label: "Google Sheet", Icon: Table2, bgClass: "bg-green-50 dark:bg-green-950/30", fgClass: "text-green-700 dark:text-green-400" };
const GSLIDES: ResourceTypeConfig = { key: "gslides", label: "Google Slides", Icon: Presentation, bgClass: "bg-amber-50 dark:bg-amber-950/30", fgClass: "text-amber-700 dark:text-amber-400" };
const GFORM: ResourceTypeConfig = { key: "gform", label: "Google Form", Icon: ClipboardList, bgClass: "bg-purple-50 dark:bg-purple-950/30", fgClass: "text-purple-700 dark:text-purple-400" };
const GDRIVE: ResourceTypeConfig = { key: "gdrive", label: "Google Drive", Icon: HardDrive, bgClass: "bg-sky-50 dark:bg-sky-950/30", fgClass: "text-sky-700 dark:text-sky-400" };
const INTERNAL: ResourceTypeConfig = { key: "internal", label: "Page", Icon: Link2, bgClass: "bg-cyan-50 dark:bg-cyan-950/30", fgClass: "text-cyan-700 dark:text-cyan-400" };
const EXTERNAL: ResourceTypeConfig = { key: "external", label: "Link", Icon: ExternalLink, bgClass: "bg-slate-100 dark:bg-slate-800/40", fgClass: "text-slate-600 dark:text-slate-400" };

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

function classifyLink(url: string): ResourceTypeConfig {
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

function plateText(node: Node): string {
  if (typeof node.text === "string") return node.text;
  const kids = node.children as Node[] | undefined;
  return kids ? kids.map(plateText).join("") : "";
}

/** The single link inside a standalone-link paragraph, or null. */
function standaloneLink(node: Node): Node | null {
  if (node.type !== "p") return null;
  const kids = ((node.children as Node[]) ?? []).filter(
    (c) => c.type === "a" || (typeof c.text === "string" && c.text.trim() !== ""),
  );
  return kids.length === 1 && kids[0].type === "a" ? kids[0] : null;
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
      name: rawName.replace(/\.[^.]+$/, ""),
      href: (node.url as string) ?? "",
      newTab: true,
      config: resolveResourceType(node),
    };
  }
  const link = standaloneLink(node);
  if (!link) return null;
  const url = (link.url as string) ?? "";
  return {
    name: plateText(link) || url,
    href: url,
    newTab: !isInternalUrl(url),
    config: resolveResourceType(node),
  };
}

/** A resource cell is a `file` void node, or a standalone-link paragraph. */
export function isResourceCell(node: Node): boolean {
  if (node.type === "file") return true;
  return standaloneLink(node) !== null;
}

/**
 * Wrap runs of 4+ consecutive resource cells in a `resource_grid` node.
 * Returns a new top-level array; never mutates the input (render-only).
 */
export function groupResourceGrids(value: Value): Value {
  const out: Value = [];
  let run: Value = [];
  const flush = () => {
    if (run.length >= 4) {
      out.push({ type: "resource_grid", children: run } as unknown as Value[number]);
    } else {
      out.push(...run);
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

/** True if the value contains at least one run that would render as a grid. */
export function hasResourceGridRun(value: Value): boolean {
  return groupResourceGrids(value).some(
    (n) => (n as Record<string, unknown>).type === "resource_grid",
  );
}
