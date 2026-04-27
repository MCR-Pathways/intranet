/**
 * Image processing pipeline for news-feed uploads.
 *
 * For every uploaded image:
 *   - Strip EXIF metadata (GPS coords from phone photos, camera serial, etc.)
 *   - Bake in EXIF orientation so portrait photos render upright
 *   - Capture width/height for layout-shift-free rendering
 *
 * Format-specific handling:
 *   - HEIC/HEIF → JPEG via heic-convert (Sharp's libheif lacks the HEVC
 *     decoder plugin — patent-encumbered) followed by Sharp post-processing.
 *   - Apple ProRAW (DNG) → JPEG via Sharp's TIFF decoder.
 *   - Animated GIF / WebP → Sharp with `{ animated: true }` to preserve frames.
 *   - Standard JPEG/PNG → Sharp standard pipeline.
 *   - Camera RAW (CR2/CR3/NEF/ARW etc.) → friendly-error rejection (no
 *     pure-JS decoder available; Sharp can't either).
 *
 * Documents (PDF/DOCX) bypass the pipeline entirely.
 */

import sharp from "sharp";
import heicConvert from "heic-convert";
import { logger } from "@/lib/logger";
import { validateMagicBytes } from "@/lib/google-drive-upload";

export type ProcessedImage =
  | {
      ok: true;
      buffer: Buffer;
      mimeType: string;
      width: number | null;
      height: number | null;
    }
  | { ok: false; error: string };

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
const DNG_TYPES = new Set(["image/x-adobe-dng", "image/dng"]);
const STANDARD_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
]);
// Both GIF and WebP can be animated. Sharp needs `{ animated: true }` to read
// all frames; the standard pipeline flattens to the first frame, so route both
// through the animated path. Static GIF/WebP files are a degenerate animated
// case (pages: 1) and re-encode correctly.
const ANIMATED_IMAGE_TYPES = new Set(["image/gif", "image/webp"]);
const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// Camera RAW formats Sharp can't decode. Detection by extension is reliable
// here because browsers usually report `application/octet-stream` for these.
const RAW_EXTENSIONS = new Set([
  "cr2", "cr3", "nef", "nrw", "arw", "srf", "sr2",
  "raf", "rw2", "orf", "pef", "x3f", "raw", "rwl",
]);

const RAW_REJECTION =
  "Camera RAW files aren't supported. Please export as JPEG before uploading.";
const GENERIC_REJECTION =
  "We couldn't process this image. If it's a RAW file, please export it as JPEG and try again.";
const TYPE_MISMATCH =
  "File content doesn't match its claimed type.";
const UNSUPPORTED_TYPE =
  "This file type isn't supported on the news feed.";

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : "";
}

/**
 * Process an uploaded file: validate, run Sharp pipeline if applicable,
 * and return the (possibly converted) buffer plus dimensions.
 */
export async function processUploadedImage(
  buffer: Buffer,
  claimedMimeType: string,
  fileName: string,
): Promise<ProcessedImage> {
  const ext = getExtension(fileName);

  // Camera RAW: friendly error, don't even try Sharp.
  if (RAW_EXTENSIONS.has(ext)) {
    return { ok: false, error: RAW_REJECTION };
  }

  // Magic-byte sanity check for known signatures. Returns true for unknown
  // types (docx etc. — they're ZIP archives without a single signature).
  if (!validateMagicBytes(buffer, claimedMimeType)) {
    return { ok: false, error: TYPE_MISMATCH };
  }

  // Documents pass through unchanged.
  if (DOCUMENT_TYPES.has(claimedMimeType)) {
    return {
      ok: true,
      buffer,
      mimeType: claimedMimeType,
      width: null,
      height: null,
    };
  }

  // HEIC/HEIF → JPEG. Browsers can't render HEIC inline. Sharp can't decode
  // HEIC either — its prebuilt libheif lacks the HEVC decoder plugin (patent
  // licensing), so we use heic-convert (pure-JS HEVC) for the decode step.
  if (HEIC_TYPES.has(claimedMimeType)) {
    return convertHeicToJpeg(buffer, fileName);
  }

  // DNG (incl. Apple ProRAW) → JPEG via Sharp's TIFF decoder.
  if (DNG_TYPES.has(claimedMimeType) || ext === "dng") {
    return convertDngToJpeg(buffer, claimedMimeType, fileName);
  }

  // Animated formats: preserve animation, strip metadata.
  if (ANIMATED_IMAGE_TYPES.has(claimedMimeType)) {
    return processAnimated(buffer, claimedMimeType, fileName);
  }

  // Standard images: rotate (bake EXIF orientation) + strip metadata + keep
  // ICC profile so colours don't shift on wide-gamut originals.
  if (STANDARD_IMAGE_TYPES.has(claimedMimeType)) {
    return processStandard(buffer, claimedMimeType, fileName);
  }

  return { ok: false, error: UNSUPPORTED_TYPE };
}

async function convertDngToJpeg(
  buffer: Buffer,
  claimedMimeType: string,
  fileName: string,
): Promise<ProcessedImage> {
  try {
    // resolveWithObject returns dims from the encode step, avoiding a
    // redundant Sharp re-parse to read metadata.
    const { data, info } = await sharp(buffer)
      .rotate()
      .jpeg({ quality: 90 })
      .keepIccProfile()
      .toBuffer({ resolveWithObject: true });
    return {
      ok: true,
      buffer: data,
      mimeType: "image/jpeg",
      width: info.width ?? null,
      height: info.height ?? null,
    };
  } catch (err) {
    logger.error("Image pipeline: convertDngToJpeg failed", {
      error: err instanceof Error ? err.message : String(err),
      claimedMimeType,
      fileName,
    });
    return { ok: false, error: GENERIC_REJECTION };
  }
}

async function convertHeicToJpeg(
  buffer: Buffer,
  fileName: string,
): Promise<ProcessedImage> {
  try {
    // Step 1: heic-convert decodes the HEVC-compressed pixels to a JPEG
    // ArrayBuffer. Sharp can't do this — its prebuilt libheif lacks the
    // HEVC decoder. heic-convert is pure JS so it works on Vercel.
    const decoded = await heicConvert({
      buffer,
      format: "JPEG",
      quality: 0.9,
    });

    // Step 2: pass through Sharp to bake in EXIF orientation, strip
    // metadata (heic-convert may propagate EXIF from the source), and
    // capture dimensions for layout-shift-free rendering.
    const { data, info } = await sharp(Buffer.from(decoded))
      .rotate()
      .jpeg({ quality: 90 })
      .keepIccProfile()
      .toBuffer({ resolveWithObject: true });

    return {
      ok: true,
      buffer: data,
      mimeType: "image/jpeg",
      width: info.width ?? null,
      height: info.height ?? null,
    };
  } catch (err) {
    logger.error("Image pipeline: convertHeicToJpeg failed", {
      error: err instanceof Error ? err.message : String(err),
      fileName,
    });
    return { ok: false, error: GENERIC_REJECTION };
  }
}

async function processAnimated(
  buffer: Buffer,
  claimedMimeType: string,
  fileName: string,
): Promise<ProcessedImage> {
  try {
    // animated:true preserves all frames through the pipeline.
    // Sharp's default toBuffer() strips metadata; rotate() is a no-op for
    // GIFs (no EXIF orientation) but harmless.
    const sharpInstance = sharp(buffer, { animated: true })
      .rotate()
      .keepIccProfile();

    // Sharp's default WebP encode quality is 80 — same silent quality
    // regression we already fixed for JPEG. Set 90 explicitly to match.
    let out: Buffer;
    if (claimedMimeType === "image/gif") {
      out = await sharpInstance.gif().toBuffer();
    } else if (claimedMimeType === "image/webp") {
      out = await sharpInstance.webp({ quality: 90 }).toBuffer();
    } else {
      out = await sharpInstance.toBuffer();
    }

    const meta = await sharp(out, { animated: true }).metadata();
    return {
      ok: true,
      buffer: out,
      mimeType: claimedMimeType,
      width: meta.width ?? null,
      height: meta.pageHeight ?? meta.height ?? null,
    };
  } catch (err) {
    logger.error("Image pipeline: processAnimated failed", {
      error: err instanceof Error ? err.message : String(err),
      claimedMimeType,
      fileName,
    });
    return { ok: false, error: GENERIC_REJECTION };
  }
}

async function processStandard(
  buffer: Buffer,
  claimedMimeType: string,
  fileName: string,
): Promise<ProcessedImage> {
  try {
    // Sharp's default JPEG encode quality is 80. Without an explicit quality
    // setting, every JPEG that reaches this path silently degrades from its
    // input quality on re-encode. Match convertDngToJpeg's quality 90.
    let pipeline = sharp(buffer).rotate().keepIccProfile();
    if (claimedMimeType === "image/jpeg") {
      pipeline = pipeline.jpeg({ quality: 90 });
    }

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    return {
      ok: true,
      buffer: data,
      mimeType: claimedMimeType,
      width: info.width ?? null,
      height: info.height ?? null,
    };
  } catch (err) {
    logger.error("Image pipeline: processStandard failed", {
      error: err instanceof Error ? err.message : String(err),
      claimedMimeType,
      fileName,
    });
    return { ok: false, error: GENERIC_REJECTION };
  }
}
