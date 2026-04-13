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
// UPLOAD
// =============================================

interface UploadResult {
  fileId: string;
  mimeType: string;
  size: number;
}

/**
 * Upload a file to the shared Drive folder.
 * Returns the file ID (not a URL — URLs come from the proxy).
 */
export async function uploadFileToDrive(
  file: Buffer,
  mimeType: string,
  fileName: string
): Promise<UploadResult> {
  const folderId = process.env.GOOGLE_DRIVE_UPLOAD_FOLDER_ID;
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_UPLOAD_FOLDER_ID is not configured");
  }

  const drive = getDriveClient();

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
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
