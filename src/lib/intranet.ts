/**
 * Shared constants and utilities for the intranet news feed.
 * Used by both client components and server actions.
 */

export const POST_MAX_LENGTH = 5000;

// Per-file caps. Images are 100 MB to accommodate iPhone ProRAW DNGs (typically
// 40–80 MB at 48 MP). Documents stay at 25 MB to match the resources module.
// The 100 MB ceiling matches `experimental.serverActions.bodySizeLimit` in
// next.config.ts — bump both together if changing.
export const IMAGE_MAX_SIZE_BYTES = 104857600; // 100 MB
export const DOCUMENT_MAX_SIZE_BYTES = 26214400; // 25 MB
/** @deprecated use IMAGE_MAX_SIZE_BYTES or DOCUMENT_MAX_SIZE_BYTES */
export const ATTACHMENT_MAX_SIZE_BYTES = IMAGE_MAX_SIZE_BYTES;

export const ATTACHMENT_MAX_COUNT = 10;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/x-adobe-dng",
  "image/dng",
] as const;

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
] as const;

/** Validate a file before upload. Returns error string or null if valid. */
export function validateFile(file: File): string | null {
  const isImage = isImageType(file.type);
  const cap = isImage ? IMAGE_MAX_SIZE_BYTES : DOCUMENT_MAX_SIZE_BYTES;
  const capLabel = isImage ? "100MB" : "25MB";

  if (file.size > cap) {
    return `"${file.name}" is too large (max ${capLabel})`;
  }
  if (
    !ALLOWED_FILE_TYPES.includes(
      file.type as (typeof ALLOWED_FILE_TYPES)[number]
    )
  ) {
    return `"${file.name}" has an unsupported file type`;
  }
  return null;
}

/** Check if a MIME type is an image type */
export function isImageType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(
    mimeType as (typeof ALLOWED_IMAGE_TYPES)[number]
  );
}
