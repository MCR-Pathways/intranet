/**
 * Asset uploader for the WP migration.
 *
 * For each URL referenced in a migrated page body, fetches the file from
 * the WordPress origin, validates it, uploads to the configured Drive
 * folder, and records both a `resource_media` row (one per Drive file)
 * and a `resource_media_articles` junction row (one per article that
 * references that file).
 *
 * Halt-and-flag policy (set by the user in the Bit 1 plan):
 *   - 404 / non-2xx fetch  → throw MigrationHaltError, script exits non-zero
 *   - file > 64 MB         → throw MigrationHaltError
 * Both produce a clear log line for the operator to resolve before re-running.
 *
 * Idempotency: queries `resource_media` by `original_url` globally across
 * all articles. On hit, reuses the existing Drive file id and inserts a
 * junction row for the current article (no Drive upload). On miss, uploads
 * + creates both the media row and the first junction row.
 *
 * Retries: Drive upload + domain-share are wrapped in a 3-attempt
 * exponential backoff (1s → 2s → 4s) so a transient Drive 5xx/429 doesn't
 * halt a bit-sized batch.
 *
 * Dry-run: when `dryRun=true`, no fetches, uploads, or DB writes happen.
 * The function returns a stub `assetMap` so downstream walker code can
 * produce a Plate tree for inspection (URLs point at `DRY_RUN_*` strings
 * that obviously aren't real file IDs).
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
  /** Article id that the uploaded files attach to (via the junction table) */
  articleId: string;
  /** Profile id of the migration runner (resource_media.uploaded_by) */
  uploadedBy: string;
  /** Page slug — used as Drive subfolder (Resources/{slug}/) */
  slug: string;
  /** Drive root folder id ("MCR Intranet Attachments") */
  driveFolderId: string;
  /** Service-role Supabase client (the script's client) */
  supabase: SupabaseClient<Database>;
  /** When true: no fetches, uploads, or DB writes. Returns a stub assetMap. */
  dryRun?: boolean;
}

export interface UploadAssetsResult {
  assetMap: Map<string, AssetInfo>;
  uploaded: number;
  /** Cross-article: existed in resource_media, junction row added or already present */
  reused: number;
  /** Dry-run: would have uploaded (or reused) but didn't */
  wouldUpload: number;
}

export async function uploadAssets({
  urls,
  attachmentsByUrl,
  articleId,
  uploadedBy,
  slug,
  driveFolderId,
  supabase,
  dryRun = false,
}: UploadAssetsParams): Promise<UploadAssetsResult> {
  const assetMap = new Map<string, AssetInfo>();
  let uploaded = 0;
  let reused = 0;
  let wouldUpload = 0;

  if (urls.length === 0) {
    return { assetMap, uploaded, reused, wouldUpload };
  }

  // Pre-flight: lookup any existing resource_media rows for these URLs.
  // Keyed by original_url GLOBALLY (across all articles), not per-article —
  // this is what unlocks cross-article dedup. The junction table tracks
  // which articles reference each media row.
  const { data: existingRows, error: existingErr } = await supabase
    .from("resource_media")
    .select("id, file_id, original_name, original_url, mime_type, file_size")
    .in("original_url", urls);
  if (existingErr) {
    throw new MigrationHaltError(
      `resource_media pre-flight lookup failed: ${existingErr.message}`,
    );
  }
  const existingByUrl = new Map(
    (existingRows ?? [])
      .filter((r) => r.original_url !== null)
      .map((r) => [r.original_url as string, r]),
  );

  for (const url of urls) {
    const attachment = attachmentsByUrl.get(url);
    const fileName = inferFileName(url, attachment?.title ?? null);

    // Cross-article dedup: URL already uploaded for some other (or this)
    // article. Link the current article via the junction; skip Drive upload.
    const existing = existingByUrl.get(url);
    if (existing) {
      assetMap.set(url, {
        fileId: existing.file_id,
        mimeType: existing.mime_type ?? inferMimeFromExt(fileName) ?? "application/octet-stream",
        fileName: existing.original_name,
        size: existing.file_size ?? 0,
      });
      reused++;
      if (dryRun) {
        log("↺ would link", fileName, `(existing media ${existing.file_id})`);
      } else {
        await ensureJunctionRow(supabase, existing.id, articleId);
        log("↺ reused", fileName, `(existing media ${existing.file_id} → junction added)`);
      }
      continue;
    }

    // Dry-run: skip fetch + upload + DB writes. Stub the assetMap so the
    // walker downstream has SOMETHING to put in `/api/drive-file/{...}` URLs.
    if (dryRun) {
      wouldUpload++;
      const stubFileId = `DRY_RUN_${wouldUpload}`;
      assetMap.set(url, {
        fileId: stubFileId,
        mimeType: inferMimeFromExt(fileName) ?? "application/octet-stream",
        fileName,
        size: 0,
      });
      log("⊘ would upload", fileName, `(${url})`);
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

    // Drive upload + domain-share with exponential backoff on transient
    // failures (Drive 5xx / 429 / network blips). 3 attempts, 1s → 2s → 4s.
    const uploadResult = await withRetry(
      () =>
        uploadFileToDrive(buffer, mimeType, fileName, {
          folderId: driveFolderId,
          subfolderPath: ["Resources", slug],
        }),
      { label: `Drive upload (${fileName})` },
    );

    // Domain-share so a signed-in MCR user can open Drive's /preview URL
    // for Office docs (DOCX/XLSX/PPTX) without a Request-Access challenge.
    // The proxy still gates direct /api/drive-file/{id} access via session
    // auth + the resource_media whitelist, independent of this share.
    await withRetry(
      () => shareFileWithDomain(uploadResult.fileId, ORG_DOMAIN),
      { label: `Drive domain-share (${fileName}, file ${uploadResult.fileId})` },
    );

    // Insert resource_media (canonical row for this Drive file) and grab
    // its id so the junction row below can link to it. article_id on
    // resource_media stays for backwards-compat reads — it points at the
    // FIRST article that referenced the file.
    const { data: insertedMedia, error: insertErr } = await supabase
      .from("resource_media")
      .insert({
        file_id: uploadResult.fileId,
        article_id: articleId,
        original_name: fileName,
        original_url: url,
        mime_type: mimeType,
        file_size: size,
        uploaded_by: uploadedBy,
      } as Database["public"]["Tables"]["resource_media"]["Insert"])
      .select("id")
      .single();

    if (insertErr || !insertedMedia) {
      throw new MigrationHaltError(
        `resource_media insert failed for ${fileName} (file uploaded to Drive ${uploadResult.fileId}): ${insertErr?.message ?? "unknown"}`,
      );
    }

    // Junction row for the current article.
    await ensureJunctionRow(supabase, insertedMedia.id, articleId);

    assetMap.set(url, {
      fileId: uploadResult.fileId,
      mimeType,
      fileName,
      size,
    });
    uploaded++;
    log("✓ uploaded", fileName, `(${formatBytes(size)}) → ${uploadResult.fileId}`);
  }

  return { assetMap, uploaded, reused, wouldUpload };
}

/** Insert junction row for (media, article); idempotent via UNIQUE constraint. */
async function ensureJunctionRow(
  supabase: SupabaseClient<Database>,
  mediaId: string,
  articleId: string,
): Promise<void> {
  const { error } = await supabase
    .from("resource_media_articles")
    .upsert(
      {
        media_id: mediaId,
        article_id: articleId,
      } as Database["public"]["Tables"]["resource_media_articles"]["Insert"],
      { onConflict: "media_id,article_id", ignoreDuplicates: true },
    );
  if (error) {
    throw new MigrationHaltError(
      `resource_media_articles junction insert failed for media=${mediaId} article=${articleId}: ${error.message}`,
    );
  }
}

/**
 * Retry `fn` up to 3 times with exponential backoff (1s → 2s → 4s) on any
 * thrown error. On final failure, rethrows as MigrationHaltError with the
 * `label` prefix so the operator can see what failed.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { label: string },
): Promise<T> {
  const delays = [1000, 2000, 4000];
  let lastErr: unknown;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      log(
        "⟳ retry",
        opts.label,
        `attempt ${attempt + 1}/${delays.length} failed: ${msg}`,
      );
      if (attempt < delays.length - 1) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
  }
  throw new MigrationHaltError(
    `${opts.label} failed after ${delays.length} attempts: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
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
