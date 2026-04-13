"use server";

/**
 * Server actions for resource media uploads.
 *
 * Files are uploaded to Google Drive and tracked in the resource_media table.
 * The proxy route at /api/drive-file/[fileId] serves them back to browsers.
 */

import { requireContentEditor } from "@/lib/auth";
import {
  uploadFileToDrive,
  deleteFileFromDrive,
  validateMagicBytes,
} from "@/lib/google-drive-upload";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";

// =============================================
// ALLOWED TYPES
// =============================================

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

// =============================================
// FILENAME SANITISATION
// =============================================

function sanitiseFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|\x00-\x1f]/g, "_") // strip path separators and control chars
    .replace(/\s+/g, " ") // collapse whitespace
    .trim()
    .slice(0, 200); // truncate
}

// =============================================
// UPLOAD
// =============================================

interface UploadResult {
  success: boolean;
  url?: string;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  error?: string;
}

export async function uploadEditorMedia(formData: FormData): Promise<UploadResult> {
  try {
    const { supabase, user } = await requireContentEditor();

    const file = formData.get("file") as File | null;
    const articleId = formData.get("articleId") as string | null;

    if (!file) {
      return { success: false, error: "No file provided" };
    }

    const mimeType = file.type;
    const isImage = IMAGE_TYPES.has(mimeType);
    const isFile = FILE_TYPES.has(mimeType);

    if (!isImage && !isFile) {
      return { success: false, error: "File type not allowed" };
    }

    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      const limitMB = maxSize / (1024 * 1024);
      return { success: false, error: `File too large (max ${limitMB} MB)` };
    }

    if (file.size === 0) {
      return { success: false, error: "File is empty" };
    }

    // Convert to Buffer for magic bytes validation + Drive upload
    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate magic bytes match claimed type
    if (!validateMagicBytes(buffer, mimeType)) {
      return { success: false, error: "File content does not match its type" };
    }

    // Generate unique filename
    const sanitised = sanitiseFilename(file.name) || "unnamed";
    const uniqueName = `${crypto.randomUUID()}-${sanitised}`;

    // Upload to Google Drive
    const result = await uploadFileToDrive(buffer, mimeType, uniqueName);

    // Track in resource_media (session-scoped client — RLS as second auth check)
    const { error: dbError } = await supabase
      .from("resource_media")
      .insert({
        file_id: result.fileId,
        article_id: articleId || null,
        original_name: file.name,
        mime_type: mimeType,
        file_size: file.size,
        uploaded_by: user.id,
      } as Database["public"]["Tables"]["resource_media"]["Insert"]);

    if (dbError) {
      logger.error("Failed to insert resource_media row", {
        error: dbError.message,
        fileId: result.fileId,
        articleId,
      });
      try {
        await deleteFileFromDrive(result.fileId);
      } catch (cleanupErr) {
        logger.error("Failed to clean up orphaned Drive file", {
          error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
          fileId: result.fileId,
        });
      }
      return { success: false, error: "Failed to register uploaded file" };
    }

    return {
      success: true,
      url: `/api/drive-file/${result.fileId}`,
      fileId: result.fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
    };
  } catch (err) {
    logger.error("uploadEditorMedia error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: "Failed to upload file" };
  }
}
