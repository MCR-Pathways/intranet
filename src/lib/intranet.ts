/**
 * Shared constants and utilities for the intranet news feed.
 * Used by both client components and server actions.
 */

export const POST_MAX_LENGTH = 5000;
export const ATTACHMENT_MAX_SIZE_BYTES = 52428800; // 50MB
export const ATTACHMENT_MAX_COUNT = 10;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
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
  if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
    return `"${file.name}" is too large (max 50MB)`;
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
