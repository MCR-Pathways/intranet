/**
 * PDF metadata extraction.
 *
 * Used at news-feed upload time to capture page count for the attachment
 * card meta line ("PDF · 12 pages · 230 KB"). Pure JS, serverless-safe via
 * `unpdf` — works on Vercel functions without native deps.
 */

import { getDocumentProxy } from "unpdf";
import { logger } from "@/lib/logger";

/**
 * Extract the page count from a PDF buffer. Returns null if the file is
 * unreadable (corrupt, password-protected, not actually a PDF). The caller
 * should fall back to a size-only meta line in the UI when null.
 */
export async function extractPdfPageCount(
  buffer: Buffer,
): Promise<number | null> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const count = pdf.numPages;
    return Number.isFinite(count) && count > 0 ? count : null;
  } catch (err) {
    logger.warn("PDF page count extraction failed — falling back to null", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
