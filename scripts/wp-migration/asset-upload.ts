/**
 * Asset uploader for the WP migration.
 *
 * For each URL referenced in a migrated page body, fetches the file from
 * the WordPress origin, validates it, uploads to the configured Drive
 * folder, and inserts a `resource_media` row tied to the new article.
 *
 * Halt-and-flag policy (set by the user in the Bit 1 plan):
 *   - 404 / non-2xx fetch  → throw MigrationHaltError, script exits non-zero
 *   - file > 25 MB         → throw MigrationHaltError
 * Both produce a clear log line for the operator to resolve before re-running.
 *
 * Idempotency: queries `resource_media` for the article before uploading;
 * if a row exists with matching `original_name` and `file_size`, reuses the
 * existing Drive file id and skips the upload.
 */
import { Buffer } from "node:buffer";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  uploadFileToDrive,
  validateMagicBytes,
  sanitiseFilename,
  shareFileWithDomain,
} from "@/lib/google-drive-upload";
import type { Database } from "@/types/database.types";
import type { AssetInfo } from "@/lib/wp-migration/html-to-plate";
import type { WpAttachment } from "./xml-parse";

// 64 MB. Migration script only — runs locally and uploads to Drive directly,
// bypassing Vercel's serverless function body limit. The UI editor's
// MAX_FILE_SIZE in media-actions.ts stays at 25 MB (effectively 4.5 MB on
// Vercel Hobby; raise on Pro upgrade).
const MAX_ASSET_BYTES = 64 * 1024 * 1024;
const ORG_DOMAIN = "mcrpathways.org";

export class MigrationHaltError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationHaltError";
  }
}

export interface UploadAssetsParams {
  /** Distinct WP URLs to upload (deduped by the caller) */
  urls: string[];
  /** Map of URL → WP attachment metadata (for nicer filenames where present) */
  attachmentsByUrl: Map<string, WpAttachment>;
  /** Article id that owns the uploaded files (resource_media.article_id) */
  articleId: string;
  /** Profile id of the migration runner (resource_media.uploaded_by) */
  uploadedBy: string;
  /** Page slug — used as Drive subfolder (Resources/{slug}/) */
  slug: string;
  /** Drive root folder id ("MCR Intranet Attachments") */
  driveFolderId: string;
  /** Service-role Supabase client (the script's client) */
  supabase: SupabaseClient<Database>;
}

export interface UploadAssetsResult {
  assetMap: Map<string, AssetInfo>;
  uploaded: number;
  skipped: number;
}

export async function uploadAssets({
  urls,
  attachmentsByUrl,
  articleId,
  uploadedBy,
  slug,
  driveFolderId,
  supabase,
}: UploadAssetsParams): Promise<UploadAssetsResult> {
  const assetMap = new Map<string, AssetInfo>();
  let uploaded = 0;
  let skipped = 0;

  // Pre-flight idempotency lookup
  const { data: existingRows, error: existingErr } = await supabase
    .from("resource_media")
    .select("file_id, original_name, mime_type, file_size")
    .eq("article_id", articleId);
  if (existingErr) {
    throw new MigrationHaltError(
      `resource_media pre-flight lookup failed: ${existingErr.message}`,
    );
  }
  const existingByName = new Map(
    (existingRows ?? []).map((r) => [r.original_name, r]),
  );

  for (const url of urls) {
    const attachment = attachmentsByUrl.get(url);
    const fileName = inferFileName(url, attachment?.title ?? null);

    // Idempotency: matched by original_name (+ existing file_size if available)
    const existing = existingByName.get(fileName);
    if (existing) {
      assetMap.set(url, {
        fileId: existing.file_id,
        mimeType: existing.mime_type ?? inferMimeFromExt(fileName) ?? "application/octet-stream",
        fileName: existing.original_name,
        size: existing.file_size ?? 0,
      });
      skipped++;
      log("↺ skipped", fileName, `(already uploaded: ${existing.file_id})`);
      continue;
    }

    // Fetch from WP origin (halt on 404 / non-2xx)
    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      throw new MigrationHaltError(
        `Network error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!response.ok) {
      throw new MigrationHaltError(
        `Asset fetch returned ${response.status} for ${url}`,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const size = buffer.length;
    if (size === 0) {
      throw new MigrationHaltError(`Empty file returned for ${url}`);
    }
    if (size > MAX_ASSET_BYTES) {
      throw new MigrationHaltError(
        `Asset exceeds 64 MB limit: ${url} (${formatBytes(size)})`,
      );
    }

    const responseMime = response.headers.get("content-type")?.split(";")[0].trim() || "";
    const mimeType = responseMime || inferMimeFromExt(fileName) || "application/octet-stream";

    if (!validateMagicBytes(buffer, mimeType)) {
      log("⚠ magic-byte mismatch", fileName, `(claimed ${mimeType}) — proceeding anyway`);
    }

    let uploadResult: { fileId: string; mimeType: string; size: number };
    try {
      uploadResult = await uploadFileToDrive(buffer, mimeType, fileName, {
        folderId: driveFolderId,
        subfolderPath: ["Resources", slug],
      });
    } catch (err) {
      throw new MigrationHaltError(
        `Drive upload failed for ${fileName}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Domain-share so a signed-in MCR user can open Drive's /preview URL
    // for Office docs (DOCX/XLSX/PPTX) without a Request-Access challenge.
    // The proxy still gates direct /api/drive-file/{id} access via session
    // auth + the resource_media whitelist, independent of this share.
    try {
      await shareFileWithDomain(uploadResult.fileId, ORG_DOMAIN);
    } catch (err) {
      throw new MigrationHaltError(
        `Drive domain-share failed for ${fileName} (file uploaded to ${uploadResult.fileId}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const { error: insertErr } = await supabase
      .from("resource_media")
      .insert({
        file_id: uploadResult.fileId,
        article_id: articleId,
        original_name: fileName,
        mime_type: mimeType,
        file_size: size,
        uploaded_by: uploadedBy,
      } as Database["public"]["Tables"]["resource_media"]["Insert"]);

    if (insertErr) {
      throw new MigrationHaltError(
        `resource_media insert failed for ${fileName} (file uploaded to Drive ${uploadResult.fileId}): ${insertErr.message}`,
      );
    }

    assetMap.set(url, {
      fileId: uploadResult.fileId,
      mimeType,
      fileName,
      size,
    });
    uploaded++;
    log("✓ uploaded", fileName, `(${formatBytes(size)}) → ${uploadResult.fileId}`);
  }

  return { assetMap, uploaded, skipped };
}

// =============================================
// HELPERS
// =============================================

function inferFileName(url: string, title: string | null): string {
  // Prefer the WP attachment title when present, but trust the URL's
  // extension over the title's. Titles like "Mentor Guide v1.2" carry a
  // trailing dot that path.extname misreads as an extension (".2"), which
  // would drop the real ".pdf" from the URL — so we only treat the title's
  // extension as authoritative when it matches the URL's.
  const urlPath = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  const urlBase = decodeURIComponent(path.basename(urlPath)) || "file";

  if (title && title.trim()) {
    const sanitised = sanitiseFilename(title.trim());
    const titleExt = path.extname(sanitised);
    const urlExt = path.extname(urlBase);

    // Title already carries the URL's extension — accept verbatim.
    if (urlExt && titleExt.toLowerCase() === urlExt.toLowerCase()) {
      return sanitised;
    }
    // Title has no extension, or a misleading one like ".1" from a version
    // number. Append the URL's extension so the file gets the right type.
    // Keeps any trailing-dot version info in the base (e.g. "Guide v1.2.pdf"
    // is fine — multi-dot filenames are valid and preserve user intent).
    if (urlExt) {
      return sanitiseFilename(`${sanitised}${urlExt}`);
    }
    // No URL extension to lean on — trust the title as-is.
    return sanitised;
  }
  return sanitiseFilename(urlBase);
}

function inferMimeFromExt(fileName: string): string | null {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".mp4":
      return "video/mp4";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case ".txt":
      return "text/plain";
    case ".csv":
      return "text/csv";
    default:
      return null;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function log(marker: string, name: string, detail: string): void {
  console.log(`  ${marker.padEnd(20)} ${name}  ${detail}`);
}
