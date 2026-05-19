/**
 * WordPress eXtended RSS (WXR) parser for the content migration.
 *
 * Uses regex extraction (not a full DOM parser) — the file is 6.5 MB and
 * we only need one page + its asset URLs. WXR field names are stable across
 * recent WP versions. If WP ever ships a less-predictable export schema,
 * swap to a streaming XML parser; don't optimise until then.
 */
import { readFileSync } from "node:fs";

export interface WpAttachment {
  url: string;
  title: string | null;
  postId: string | null;
  postParent: string | null;
}

export interface WpPage {
  slug: string;
  title: string;
  link: string;
  content: string;
  postId: string;
  status: string;
  postDate: string;
  postModified: string;
  creator: string;
}

export interface LoadedWpExport {
  xml: string;
  attachmentsByUrl: Map<string, WpAttachment>;
}

/** Read the XML file and build an attachment-URL → metadata map. */
export function loadWpExport(xmlPath: string): LoadedWpExport {
  const xml = readFileSync(xmlPath, "utf8");

  const attachmentsByUrl = new Map<string, WpAttachment>();
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = m[1];
    if (!isPostType(item, "attachment")) continue;
    const url = matchCData(item, "wp:attachment_url");
    if (!url) continue;
    attachmentsByUrl.set(url.trim(), {
      url: url.trim(),
      title: matchCDataOrText(item, "title"),
      postId: matchTagText(item, "wp:post_id"),
      postParent: matchTagText(item, "wp:post_parent"),
    });
  }

  return { xml, attachmentsByUrl };
}

/** Find a single page by its WP slug (wp:post_name). Returns null if absent. */
export function findPageBySlug(xml: string, slug: string): WpPage | null {
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = m[1];
    if (!isPostType(item, "page")) continue;

    const postName = matchCData(item, "wp:post_name");
    if (postName !== slug) continue;

    return {
      slug: postName,
      title: matchCDataOrText(item, "title") ?? "",
      link: matchTagText(item, "link") ?? "",
      content: matchCData(item, "content:encoded") ?? "",
      postId: matchTagText(item, "wp:post_id") ?? "",
      status: matchCData(item, "wp:status") ?? "",
      postDate: matchTagText(item, "wp:post_date") ?? "",
      postModified: matchTagText(item, "wp:post_modified") ?? "",
      creator: matchCDataOrText(item, "dc:creator") ?? "",
    };
  }
  return null;
}

// =============================================
// Regex helpers
// =============================================

function isPostType(item: string, type: string): boolean {
  const re = new RegExp(
    `<wp:post_type><!\\[CDATA\\[${escapeRegex(type)}\\]\\]><\\/wp:post_type>`,
  );
  return re.test(item);
}

function matchCData(item: string, tag: string): string | null {
  const re = new RegExp(
    `<${escapeRegex(tag)}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${escapeRegex(tag)}>`,
  );
  const m = item.match(re);
  return m ? m[1] : null;
}

function matchTagText(item: string, tag: string): string | null {
  const re = new RegExp(
    `<${escapeRegex(tag)}>([\\s\\S]*?)<\\/${escapeRegex(tag)}>`,
  );
  const m = item.match(re);
  return m ? m[1].trim() : null;
}

function matchCDataOrText(item: string, tag: string): string | null {
  return matchCData(item, tag) ?? matchTagText(item, tag);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
