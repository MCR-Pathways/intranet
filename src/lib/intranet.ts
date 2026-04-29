/**
 * Shared constants and utilities for the intranet news feed.
 * Used by both client components and server actions.
 */

export const POST_MAX_LENGTH = 5000;

// Per-file caps. Held under Vercel Hobby's 4.5 MB hard limit on serverless
// function request bodies — that limit is platform-level and cannot be
// overridden by `bodySizeLimit` in next.config.ts. Anything bigger gets a
// 413 from Vercel's edge before the function runs.
//
// REVISIT when upgrading to Vercel Pro: raise both to ~100 MB so iPhone ProRAW
// DNGs (40–80 MB) and large screenshots fit. Sharp pipeline already handles
// the bigger files; only the platform cap is the constraint. Tracked in
// memory/news-feed-drive-media-backlog.md.
export const IMAGE_MAX_SIZE_BYTES = 4194304; // 4 MB
export const DOCUMENT_MAX_SIZE_BYTES = 4194304; // 4 MB
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

  if (file.size > cap) {
    return `"${file.name}" is too large (max 4MB)`;
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
