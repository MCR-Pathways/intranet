/**
 * Google Drive file upload, deletion, and streaming for resource media.
 *
 * Uploaded files go to the GOOGLE_DRIVE_UPLOAD_FOLDER_ID folder
 * via the service account with domain-wide delegation.
 * Served back through the /api/drive-file/[fileId] proxy route.
 */

import { Readable } from "stream";
import { getDriveClient } from "@/lib/google-drive";
import { logger } from "@/lib/logger";

// Google Drive file IDs use only these characters
export const DRIVE_FILE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

// =============================================
// MAGIC BYTES VALIDATION
// =============================================

const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }[]> = {
  "image/png": [{ bytes: [0x89, 0x50, 0x4e, 0x47] }], // \x89PNG
  "image/jpeg": [{ bytes: [0xff, 0xd8, 0xff] }],
  "image/gif": [{ bytes: [0x47, 0x49, 0x46, 0x38] }], // GIF8 (covers GIF87a and GIF89a)
  "image/webp": [
    { bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF at offset 0
    { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // WEBP at offset 8
  ],
  "image/heic": [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }], // ftyp at offset 4 (HEIF/HEIC family)
  "image/heif": [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  "image/x-adobe-dng": [
    // DNG is a TIFF subset — both endianness markers covered
    { bytes: [0x49, 0x49, 0x2a, 0x00] }, // II*\0 little-endian TIFF
  ],
  "image/dng": [{ bytes: [0x49, 0x49, 0x2a, 0x00] }],
  "application/pdf": [{ bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }], // %PDF-
};

/**
 * Validate that a file's first bytes match its claimed MIME type.
 * Returns true if the bytes match, false if they don't or the type isn't checkable.
 * Types without registered signatures (e.g. docx, xlsx) pass through — they're
 * ZIP archives with no single magic byte pattern.
 */
export function validateMagicBytes(buffer: Buffer, claimedMimeType: string): boolean {
  const signatures = MAGIC_BYTES[claimedMimeType];
  if (!signatures) return true; // No signature to check — pass through

  for (const sig of signatures) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) return false;

    const match = sig.bytes.every((byte, i) => buffer[offset + i] === byte);
    if (!match) return false;
  }

  return true;
}

// =============================================
// FILENAME SANITISATION
// =============================================

/** Strip path separators and control chars; collapse whitespace; truncate. */
export function sanitiseFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

// =============================================
// SUBFOLDER RESOLUTION
// =============================================

// Module-level cache: maps "<parentId>/<name>" -> resolved childId.
// Lives on the warm serverless instance (~15 min). One files.list per
// (parent, name) miss per warm window; zero on hits.
const subfolderCache = new Map<string, string>();

async function resolveOrCreateSubfolder(
  parentId: string,
  name: string,
): Promise<string> {
  const key = `${parentId}/${name}`;
  const cached = subfolderCache.get(key);
  if (cached) return cached;

  const drive = getDriveClient();

  // Look up existing folder
  const escaped = name.replace(/'/g, "\\'");
  const list = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  });

  const existing = list.data.files?.[0]?.id;
  if (existing) {
    subfolderCache.set(key, existing);
    return existing;
  }

  // Create the folder
  // Race window: two concurrent uploads on a cold instance at month rollover
  // can each create a duplicate sibling. Drive doesn't enforce unique folder
  // names. Accepted as cosmetic — admin can merge in the Drive UI.
  const created = await drive.files.create({
    requestBody: {
      name,
      parents: [parentId],
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  if (!created.data.id) {
    throw new Error(`Drive API returned no folder ID for ${name}`);
  }

  subfolderCache.set(key, created.data.id);
  return created.data.id;
}

// =============================================
// UPLOAD
// =============================================

interface UploadResult {
  fileId: string;
  mimeType: string;
  size: number;
}

interface UploadOptions {
  /** Override the default GOOGLE_DRIVE_UPLOAD_FOLDER_ID. */
  folderId?: string;
  /** Subfolder path under the root folder. Each segment resolves or creates lazily. */
  subfolderPath?: string[];
}

/**
 * Upload a file to a Drive folder.
 * Returns the file ID (not a URL — URLs come from the proxy).
 *
 * Default folder is GOOGLE_DRIVE_UPLOAD_FOLDER_ID (resources). Pass options.folderId
 * to upload elsewhere (e.g. GOOGLE_DRIVE_NEWS_FEED_FOLDER_ID for news-feed media).
 * Pass options.subfolderPath like ["2026", "04"] to upload into nested folders that
 * are auto-created if missing.
 */
export async function uploadFileToDrive(
  file: Buffer,
  mimeType: string,
  fileName: string,
  options?: UploadOptions,
): Promise<UploadResult> {
  const rootFolderId =
    options?.folderId ?? process.env.GOOGLE_DRIVE_UPLOAD_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error(
      "No Drive folder configured (GOOGLE_DRIVE_UPLOAD_FOLDER_ID or options.folderId required)",
    );
  }

  // Walk the subfolder path, resolving or creating each level.
  let parentId = rootFolderId;
  for (const segment of options?.subfolderPath ?? []) {
    parentId = await resolveOrCreateSubfolder(parentId, segment);
  }

  const drive = getDriveClient();

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentId],
      mimeType,
    },
    media: {
      mimeType,
      body: Readable.from(file),
    },
    fields: "id,mimeType,size",
  });

  if (!res.data.id) {
    throw new Error("Drive API returned no file ID");
  }

  return {
    fileId: res.data.id,
    mimeType: res.data.mimeType ?? mimeType,
    size: res.data.size ? parseInt(res.data.size, 10) : file.length,
  };
}

// =============================================
// DELETE
// =============================================

/**
 * Share a Drive file with an entire Google Workspace domain (Reader role).
 *
 * Used by the news-feed upload pipeline so that signed-in MCR users can load
 * Drive's `https://drive.google.com/file/d/{id}/preview` URL inside our
 * document lightbox. Without domain share, Drive returns "Request access" to
 * the user — proxy auth alone doesn't help for Drive's own preview viewer.
 *
 * Throws on failure — the upload action wraps this in a try/catch and aborts
 * the upload (deleting the just-uploaded file) so we don't land non-previewable
 * documents.
 */
export async function shareFileWithDomain(
  fileId: string,
  domain: string,
): Promise<void> {
  if (!DRIVE_FILE_ID_REGEX.test(fileId)) {
    throw new Error(`Invalid Drive file ID: ${fileId}`);
  }

  const drive = getDriveClient();
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "domain",
      domain,
    },
    // sendNotificationEmail defaults to true for user/group, but is ignored
    // for domain shares. Setting explicitly to be safe across API changes.
    sendNotificationEmail: false,
  });
}

/**
 * Delete a file from Google Drive. Returns true on success, false on 404/error.
 */
export async function deleteFileFromDrive(fileId: string): Promise<boolean> {
  if (!DRIVE_FILE_ID_REGEX.test(fileId)) return false;

  try {
    const drive = getDriveClient();
    await drive.files.delete({ fileId });
    return true;
  } catch (err) {
    const error = err as { code?: number; message?: string };
    if (error.code === 404) return false;
    logger.error("Failed to delete Drive file", { error: error.message, fileId });
    return false;
  }
}

// =============================================
// STREAM (for proxy route)
// =============================================

interface DriveContentStream {
  stream: Readable;
}

/**
 * Get a content stream for a Drive file.
 *
 * Returns null if the file doesn't exist (404).
 * Throws on all other errors (500, permission, network) so the caller
 * can return an appropriate HTTP status.
 *
 * Metadata (mimeType, size, name) should come from the resource_media
 * DB table, not from Drive — this avoids a redundant API call.
 */
export async function getDriveContentStream(fileId: string): Promise<DriveContentStream | null> {
  if (!DRIVE_FILE_ID_REGEX.test(fileId)) return null;

  try {
    const drive = getDriveClient();

    const content = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    return {
      stream: content.data as unknown as Readable,
    };
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 404) {
      return null;
    }
    logger.error("Failed to stream Drive file", {
      error: err instanceof Error ? err.message : String(err),
      fileId,
    });
    throw err;
  }
}
