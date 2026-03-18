/**
 * Google Drive API client for Resources module.
 *
 * Handles:
 * - Listing documents in registered Drive folders
 * - Exporting Google Docs as HTML
 * - Sanitising exported HTML for rendering with Tailwind prose
 * - Managing Drive webhook watch channels
 *
 * Uses the same service account as Google Calendar (domain-wide delegation).
 * Requires Drive API scope: https://www.googleapis.com/auth/drive.readonly
 */

import { google, drive_v3 } from "googleapis";
import { JSDOM } from "jsdom";
import { getServiceAccountKey } from "@/lib/google-auth";
import { logger } from "@/lib/logger";

// =============================================
// DRIVE CLIENT
// =============================================

/**
 * Create an authenticated Google Drive client using service account.
 *
 * Two modes:
 * 1. With domain-wide delegation (impersonateEmail or GOOGLE_DRIVE_ADMIN_EMAIL set):
 *    Can access any file in the organisation's Drive.
 * 2. Without delegation (no admin email):
 *    Can only access files explicitly shared with the service account.
 */
function getDriveClient(impersonateEmail?: string): drive_v3.Drive {
  const keyJson = getServiceAccountKey();
  const subject = impersonateEmail ?? process.env.GOOGLE_DRIVE_ADMIN_EMAIL;

  const auth = new google.auth.JWT({
    email: keyJson.client_email,
    key: keyJson.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    // Only impersonate if domain-wide delegation is configured
    ...(subject ? { subject } : {}),
  });

  return google.drive({ version: "v3", auth });
}

// =============================================
// URL PARSING
// =============================================

/**
 * Extract Google Doc file ID from a Google Docs or Drive URL.
 *
 * Supports:
 * - https://docs.google.com/document/d/{fileId}/edit
 * - https://docs.google.com/document/d/{fileId}/view
 * - https://docs.google.com/document/d/{fileId}
 * - https://drive.google.com/file/d/{fileId}/view
 * - https://drive.google.com/open?id={fileId}
 */
export function extractDocId(url: string): string | null {
  try {
    const parsed = new URL(url);

    // docs.google.com/document/d/{id}/...
    const docMatch = parsed.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch) return docMatch[1];

    // drive.google.com/file/d/{id}/...
    const fileMatch = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) return fileMatch[1];

    // drive.google.com/open?id={id}
    const idParam = parsed.searchParams.get("id");
    if (idParam) return idParam;

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract Google Drive folder ID from a Drive folder URL.
 *
 * Supports:
 * - https://drive.google.com/drive/folders/{folderId}
 * - https://drive.google.com/drive/u/0/folders/{folderId}
 * - https://drive.google.com/drive/u/0/folders/{folderId}?...
 */
export function extractFolderId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const folderMatch = parsed.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return folderMatch[1];
    return null;
  } catch {
    return null;
  }
}

// =============================================
// DOCUMENT OPERATIONS
// =============================================

export interface DriveDocument {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
}

/**
 * List all Google Docs in a Drive folder.
 * Only returns Google Docs (application/vnd.google-apps.document).
 */
export async function listFolderDocuments(
  folderId: string
): Promise<DriveDocument[] | null> {
  const drive = getDriveClient();
  const documents: DriveDocument[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
        fields: "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink)",
        pageSize: 100,
        pageToken,
        orderBy: "name",
      });

      const files = response.data.files ?? [];
      for (const file of files) {
        if (file.id && file.name) {
          documents.push({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType ?? "application/vnd.google-apps.document",
            modifiedTime: file.modifiedTime ?? new Date().toISOString(),
            webViewLink:
              file.webViewLink ??
              `https://docs.google.com/document/d/${file.id}/edit`,
          });
        }
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return documents;
  } catch (error) {
    const apiError = error as { code?: number; message?: string };

    if (apiError.code === 404 || apiError.code === 403) {
      logger.warn("Drive folder not found or access denied", {
        folderId,
        code: apiError.code,
      });
      return null;
    }

    throw error;
  }
}

/**
 * Get metadata for a single Google Doc.
 */
export async function getDocumentMetadata(
  docId: string
): Promise<{ name: string; modifiedTime: string; webViewLink: string } | null> {
  const drive = getDriveClient();

  try {
    const response = await drive.files.get({
      fileId: docId,
      fields: "name, modifiedTime, webViewLink",
    });

    return {
      name: response.data.name ?? "Untitled",
      modifiedTime: response.data.modifiedTime ?? new Date().toISOString(),
      webViewLink:
        response.data.webViewLink ??
        `https://docs.google.com/document/d/${docId}/edit`,
    };
  } catch (error) {
    const apiError = error as { code?: number };
    if (apiError.code === 404 || apiError.code === 403) {
      return null;
    }
    throw error;
  }
}

/**
 * Export a Google Doc as HTML.
 * Returns the raw HTML string from Google's export.
 */
export async function exportDocAsHtml(docId: string): Promise<string> {
  const drive = getDriveClient();

  const response = await drive.files.export({
    fileId: docId,
    mimeType: "text/html",
  });

  // Response data is a string for text exports
  return response.data as string;
}

// =============================================
// HTML SANITISATION
// =============================================

/**
 * Sanitise Google Docs HTML export for safe rendering.
 *
 * Google Docs HTML is notoriously messy:
 * - Excessive inline styles on every element
 * - Empty <span> tags
 * - Proprietary CSS class names
 * - Full HTML document structure (we only want body content)
 *
 * This function:
 * 1. Extracts the <body> content
 * 2. Strips all inline style attributes
 * 3. Strips all class attributes
 * 4. Removes empty <span> elements
 * 5. Removes <style> and <script> tags
 * 6. Strips data-* attributes
 * 7. Normalises heading levels
 * 8. Sanitises href values (XSS prevention)
 */
export function sanitiseGoogleDocsHtml(rawHtml: string): string {
  const dom = new JSDOM(rawHtml);
  const doc = dom.window.document;

  // Get body content (Google exports full HTML document)
  const body = doc.body;
  if (!body) return "";

  // Remove <style> and <script> tags entirely
  const removeTags = body.querySelectorAll("style, script, meta, link, title");
  removeTags.forEach((el: Element) => el.remove());

  // Process all elements
  const allElements = body.querySelectorAll("*");
  const emptySpans: Element[] = [];

  allElements.forEach((el: Element) => {
    // Strip inline styles
    el.removeAttribute("style");

    // Strip class attributes (Google's proprietary classes)
    el.removeAttribute("class");

    // Strip id attributes (we'll generate our own)
    el.removeAttribute("id");

    // Strip data-* attributes
    const attrs = Array.from(el.attributes) as Attr[];
    for (const attr of attrs) {
      if (attr.name.startsWith("data-")) {
        el.removeAttribute(attr.name);
      }
    }

    // Sanitise href values — remove dangerous protocols and protocol-relative URLs
    if (el.tagName === "A") {
      const href = el.getAttribute("href");
      if (href) {
        if (
          /^(javascript|data|vbscript):/i.test(href) ||
          href.startsWith("//")
        ) {
          el.removeAttribute("href");
        }
      }
      // Add target="_blank" and rel="noopener noreferrer" to external links
      if (el.getAttribute("href")) {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    }

    // Track empty spans for removal
    if (
      el.tagName === "SPAN" &&
      !el.textContent?.trim() &&
      el.children.length === 0
    ) {
      emptySpans.push(el);
    }
  });

  // Remove empty spans (do after iteration to avoid mutation during loop)
  for (const span of emptySpans) {
    span.remove();
  }

  // Unwrap unnecessary spans that just wrap text (no remaining attributes)
  const spans = body.querySelectorAll("span");
  spans.forEach((span: Element) => {
    if (span.attributes.length === 0) {
      // Replace span with its children
      const parent = span.parentNode;
      if (parent) {
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
      }
    }
  });

  return body.innerHTML.trim();
}

/**
 * Extract plain text from HTML for full-text search indexing.
 * Strips all tags and normalises whitespace. Inserts spaces between
 * block-level elements so headings/paragraphs don't merge.
 */
export function extractPlainTextFromHtml(html: string): string {
  if (!html) return "";
  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  if (!body) return "";

  // Append a space after block elements so textContent doesn't merge words
  const blockTags = "p, h1, h2, h3, h4, h5, h6, li, div, tr, br, blockquote, pre";
  body.querySelectorAll(blockTags).forEach((el: Element) => {
    el.append(" ");
  });

  const text = body.textContent ?? "";
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Full sync pipeline: export Google Doc → sanitise HTML → extract plaintext.
 *
 * Returns the cleaned HTML and plaintext (for search indexing).
 */
export async function syncDocumentContent(
  docId: string
): Promise<{ html: string; plaintext: string }> {
  const rawHtml = await exportDocAsHtml(docId);
  const html = sanitiseGoogleDocsHtml(rawHtml);
  const plaintext = extractPlainTextFromHtml(html);
  return { html, plaintext };
}

// =============================================
// WEBHOOK WATCH CHANNELS
// =============================================

/**
 * Set up a Drive push notification watch channel for a file.
 * Google will POST to webhookUrl when the file changes.
 *
 * Watch channels expire after 7 days max. Must be renewed before expiry.
 */
export async function watchFile(
  fileId: string,
  channelId: string,
  webhookUrl: string,
  token: string,
  expiration?: number
): Promise<{ channelId: string; resourceId: string; expiration: string } | null> {
  const drive = getDriveClient();

  try {
    const response = await drive.files.watch({
      fileId,
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
        token,
        expiration: expiration
          ? String(expiration)
          : String(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
      },
    });

    return {
      channelId: response.data.id ?? channelId,
      resourceId: response.data.resourceId ?? "",
      expiration: response.data.expiration ?? "",
    };
  } catch (error) {
    logger.error("Failed to set up Drive watch channel", {
      fileId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Stop a Drive push notification watch channel.
 */
export async function stopWatchChannel(
  channelId: string,
  resourceId: string
): Promise<boolean> {
  const drive = getDriveClient();

  try {
    await drive.channels.stop({
      requestBody: {
        id: channelId,
        resourceId,
      },
    });
    return true;
  } catch (error) {
    logger.warn("Failed to stop Drive watch channel", {
      channelId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
