/**
 * Google Doc/Drive URL parsing utilities.
 *
 * Extracted from google-drive.ts so client components can import
 * without pulling in the server-only googleapis package.
 */

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

    // drive.google.com/open?id={id} — restrict to drive.google.com only
    if (parsed.hostname === "drive.google.com") {
      const idParam = parsed.searchParams.get("id");
      if (idParam) return idParam;
    }

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

/**
 * Unwrap Google redirect URLs.
 *
 * Google Docs exports sometimes wrap links in:
 *   https://www.google.com/url?q=ACTUAL_URL&sa=D&...
 *
 * Extracts and returns the actual URL from the `q` parameter.
 * Returns the original URL unchanged if it's not a redirect.
 */
export function unwrapGoogleRedirect(url: string): string {
  try {
    const parsed = new URL(url);
    if (
      (parsed.hostname === "www.google.com" || parsed.hostname === "google.com") &&
      parsed.pathname === "/url"
    ) {
      const target = parsed.searchParams.get("q");
      if (target) return target;
    }
    return url;
  } catch {
    return url;
  }
}
