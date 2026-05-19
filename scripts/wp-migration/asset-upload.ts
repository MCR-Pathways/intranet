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
  deleteFileFromDrive,
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

// Chunk size for .in() lookups. WP upload URLs are ~100 chars; a chunk of
// 50 produces a query parameter ~5KB, well under PostgREST's ~8KB
// practical URL-length ceiling. group-work (71 PDFs) is the only single
// page in scope today that exceeds one chunk.
const LOOKUP_CHUNK_SIZE = 50;

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

  // Pre-flight #1: lookup any existing resource_media rows for these URLs.
  // Keyed by original_url GLOBALLY (across all articles), not per-article —
  // this is what unlocks cross-article dedup. The junction table tracks
  // which articles reference each media row.
  //
  // Chunked .in() to keep the URL parameter list under PostgREST's
  // practical query-length limit (~8KB headers). WP attachment URLs are
  // ~100 chars; a single chunk of 50 is ~5KB which leaves headroom.
  // group-work (71 PDFs) is the largest single article in scope today,
  // so this matters for that one page.
  const rowsByUrl = await chunkedIn(
    urls,
    LOOKUP_CHUNK_SIZE,
    (chunk) =>
      supabase
        .from("resource_media")
        .select("id, file_id, original_name, original_url, mime_type, file_size")
        .in("original_url", chunk),
    "pre-flight URL lookup",
  );
  const existingByUrl = new Map(
    rowsByUrl
      .filter((r) => r.original_url !== null)
      .map((r) => [r.original_url as string, r]),
  );

  // Pre-flight #2: legacy fallback for rows uploaded before migration 00097
  // landed (no `original_url` to key by). For those, match by original_name
  // within the current article's existing media — same shape as the old
  // per-article idempotency check. Without this, the first re-run after
  // migration 00097 ships would re-upload every asset on every article
  // we've already migrated.
  const expectedFileNames = urls.map((url) => {
    const attachment = attachmentsByUrl.get(url);
    return inferFileName(url, attachment?.title ?? null);
  });
  const legacyRows = await chunkedIn(
    expectedFileNames,
    LOOKUP_CHUNK_SIZE,
    (chunk) =>
      supabase
        .from("resource_media")
        .select("id, file_id, original_name, original_url, mime_type, file_size, article_id")
        .eq("article_id", articleId)
        .in("original_name", chunk)
        .is("original_url", null),
    "pre-flight legacy lookup",
  );
  const legacyByName = new Map(
    legacyRows.map((r) => [r.original_name, r]),
  );

  // Collect media ids to link to this article via the junction, then batch
  // the upsert at the end of the loop. One round-trip beats N for
  // asset-heavy pages like group-work (71 PDFs).
  const junctionMediaIds: string[] = [];

  for (const url of urls) {
    const attachment = attachmentsByUrl.get(url);
    const fileName = inferFileName(url, attachment?.title ?? null);

    // Cross-article dedup: URL already uploaded for some other (or this)
    // article. Link the current article via the junction; skip Drive upload.
    const existing =
      existingByUrl.get(url) ?? legacyByName.get(fileName);
    if (existing) {
      assetMap.set(url, {
        fileId: existing.file_id,
        mimeType: existing.mime_type,
        fileName: existing.original_name,
        size: existing.file_size,
      });
      reused++;
      if (dryRun) {
        log("↺ would link", fileName, `(existing media ${existing.file_id})`);
      } else {
        junctionMediaIds.push(existing.id);
        log("↺ reused", fileName, `(existing media ${existing.file_id})`);
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
    // failures (Drive 5xx / 429 / network blips).
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
    // Cleanup: if the share fails after upload succeeded, delete the now-
    // orphaned Drive file. Same orphan-prevention pattern as media-actions.ts.
    try {
      await withRetry(
        () => shareFileWithDomain(uploadResult.fileId, ORG_DOMAIN),
        { label: `Drive domain-share (${fileName}, file ${uploadResult.fileId})` },
      );
    } catch (err) {
      await cleanupOrphanedDriveFile(uploadResult.fileId, fileName, "share-failed");
      throw err;
    }

    // Insert resource_media (canonical row for this Drive file) and grab
    // its id so the junction row below can link to it. article_id on
    // resource_media stays for backwards-compat reads — it points at the
    // FIRST article that referenced the file.
    //
    // Cleanup: if the DB insert fails after Drive upload + share succeeded,
    // delete the orphaned file so a retry doesn't leave Drive littered.
    // Wrap the whole insert in try/catch so a network-layer throw (timeout,
    // socket reset) also triggers cleanup — supabase-js returns errors via
    // `{ error }` for HTTP-level failures but throws for true network
    // exceptions, and we need both paths to clean up.
    let insertedMediaId: string;
    try {
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
        throw new Error(insertErr?.message ?? "resource_media insert returned no row");
      }
      insertedMediaId = insertedMedia.id;
    } catch (err) {
      await cleanupOrphanedDriveFile(uploadResult.fileId, fileName, "db-insert-failed");
      throw new MigrationHaltError(
        `resource_media insert failed for ${fileName} (Drive file ${uploadResult.fileId} cleaned up): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Queue the junction row — single batch insert after the loop.
    junctionMediaIds.push(insertedMediaId);

    assetMap.set(url, {
      fileId: uploadResult.fileId,
      mimeType,
      fileName,
      size,
    });
    uploaded++;
    log("✓ uploaded", fileName, `(${formatBytes(size)}) → ${uploadResult.fileId}`);
  }

  // Batch junction-row insert: one round-trip for all (mediaId, articleId)
  // pairs accumulated during the loop (both new uploads and cross-article
  // reuses). Dedupe locally first; the table-level UNIQUE constraint plus
  // ignoreDuplicates: true also handles concurrent-run safety.
  if (!dryRun && junctionMediaIds.length > 0) {
    const uniqueMediaIds = Array.from(new Set(junctionMediaIds));
    const { error: junctionErr } = await supabase
      .from("resource_media_articles")
      .upsert(
        uniqueMediaIds.map((mediaId) => ({
          media_id: mediaId,
          article_id: articleId,
        })) as Database["public"]["Tables"]["resource_media_articles"]["Insert"][],
        { onConflict: "media_id,article_id", ignoreDuplicates: true },
      );
    if (junctionErr) {
      throw new MigrationHaltError(
        `resource_media_articles batch upsert failed (${uniqueMediaIds.length} rows for article ${articleId}): ${junctionErr.message}`,
      );
    }
  }

  return { assetMap, uploaded, reused, wouldUpload };
}

/**
 * Retry `fn` on TRANSIENT errors only (Drive 429 or 5xx,
 * ENOTFOUND/ECONNRESET etc.). Client errors (4xx other than 429, e.g.
 * 400/401/403/404) throw immediately — retrying them just wastes time
 * and masks misconfiguration.
 *
 * googleapis errors carry a numeric `code` field for HTTP status; node
 * fetch/network errors carry an `errno`/`code` string. We check both.
 */
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000]; // wait BEFORE attempts 2 and 3; length === MAX_ATTEMPTS - 1

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { label: string },
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err)) {
        throw new MigrationHaltError(
          `${opts.label} failed with non-transient error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      log(
        "⟳ retry",
        opts.label,
        `transient (attempt ${attempt + 1}/${MAX_ATTEMPTS}): ${msg}`,
      );
      if (attempt < BACKOFF_MS.length) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
      }
    }
  }
  throw new MigrationHaltError(
    `${opts.label} failed after ${MAX_ATTEMPTS} attempts: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
}

/**
 * Run a `.in()` lookup in chunks to stay under PostgREST's URL-length
 * ceiling, concatenating the rows from each chunk. The `runQuery`
 * callback returns a PostgREST query builder result — same shape as a
 * direct .in() call — so callers can compose any additional filters
 * (.eq, .is, .select) inside the callback.
 */
async function chunkedIn<T>(
  values: string[],
  chunkSize: number,
  runQuery: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    const { data, error } = await runQuery(chunk);
    if (error) {
      throw new MigrationHaltError(
        `${label} failed (chunk ${i}–${i + chunk.length}): ${error.message}`,
      );
    }
    if (data) out.push(...data);
  }
  return out;
}

/**
 * Best-effort cleanup of a Drive file we uploaded but couldn't fully
 * register (share failed, or DB insert failed). Logs on cleanup failure
 * but never throws — the caller is already on an error path and the
 * orphaned file is recoverable manually via the Drive admin UI.
 */
async function cleanupOrphanedDriveFile(
  fileId: string,
  fileName: string,
  reason: string,
): Promise<void> {
  try {
    await deleteFileFromDrive(fileId);
    log("✗ cleaned up", fileName, `(orphaned ${fileId}; reason: ${reason})`);
  } catch (cleanupErr) {
    log(
      "⚠ cleanup failed",
      fileName,
      `(orphaned ${fileId}; reason: ${reason}; cleanup error: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)})`,
    );
  }
}

/** True for HTTP 429 / 5xx and common transient network error codes. */
function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; status?: unknown };

  // googleapis errors expose HTTP status as a number on `code`.
  if (typeof e.code === "number") {
    return e.code === 429 || (e.code >= 500 && e.code < 600);
  }
  // Some fetch / network errors put HTTP status on `status` instead.
  if (typeof e.status === "number") {
    return e.status === 429 || (e.status >= 500 && e.status < 600);
  }
  // Node socket/network errors carry a string `code` like ECONNRESET.
  if (typeof e.code === "string") {
    return TRANSIENT_NET_CODES.has(e.code);
  }
  return false;
}

const TRANSIENT_NET_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
]);

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
