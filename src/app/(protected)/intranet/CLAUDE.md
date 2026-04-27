# Intranet (news feed) Module

News-feed posts, comments, polls, weekly roundups, and post-level media.

## Media Storage

**News-feed media lives on Google Drive, not Supabase Storage.** Uploads are handled via the service-account Drive (`intranet-service-account@mcrpathways.org`), with files placed under `GOOGLE_DRIVE_NEWS_FEED_FOLDER_ID`. Supabase Storage was retired in migration `00087_news_feed_drive_media.sql` because MCR has ~120 TB of free Drive storage available.

**Files are organised under `YYYY/MM` subfolders** (UTC year + zero-padded month) auto-created on first upload of the month. The `uploadFileToDrive` helper resolves or creates each path segment lazily and caches resolved IDs in module scope (~15 min lifetime on warm serverless instances). One `files.list` per `(year, month)` cache miss; zero on hits.

**Race window at month rollover:** two concurrent uploads on a cold instance can each create a duplicate `YYYY/MM` sibling folder. Drive does not enforce unique folder names. Accepted as cosmetic — admin can merge in the Drive UI if it ever happens.

## Image Pipeline

Every uploaded image runs through `src/lib/image-pipeline.ts` (Sharp via libvips) before reaching Drive:

- **EXIF stripping** is the default — phone photos can carry GPS coordinates, camera serial numbers, and shooting metadata. Sharp's `toBuffer()` strips EXIF unless `withMetadata()` is called. We call `keepIccProfile()` to preserve color profile (so wide-gamut images don't shift on render) but everything else is dropped.
- **`rotate()` is called before stripping** so EXIF orientation is baked into the pixel data. Without this, portrait phone photos would render sideways once the orientation tag is gone.
- **HEIC / HEIF → JPEG** at quality 90. Browsers can't render HEIC inline.
- **Apple ProRAW (DNG) → JPEG** via Sharp's TIFF path. ProRAW files are typically 40–80 MB at 48 MP; converted JPEGs come out at 5–10 MB.
- **Camera RAW** (CR2/CR3/NEF/ARW etc.) is rejected with a friendly error pointing at the JPEG export path. libvips' npm-distributed binary doesn't include libraw, and a custom build isn't viable on Vercel.
- **Animated GIFs** preserve all frames via `sharp(buf, { animated: true })`.
- **Documents** (PDF, DOCX) bypass Sharp entirely.

## File Size Caps

- **Images:** 100 MB (`IMAGE_MAX_SIZE_BYTES` in `src/lib/intranet.ts`). Sized for iPhone ProRAW DNGs which routinely run 40–80 MB at 48 MP.
- **Documents:** 25 MB (`DOCUMENT_MAX_SIZE_BYTES`). Matches the resources module.
- **`bodySizeLimit` in `next.config.ts` must match `IMAGE_MAX_SIZE_BYTES`** (the larger of the two). They're kept in sync — bump together if changing.
- **Page-level `maxDuration = 60`** is set on `src/app/(protected)/intranet/page.tsx`. Server Actions invoked from the feed page inherit it. Sized for a 100 MB upload on a slow connection plus Sharp processing (~1s) plus Drive upload of the converted JPEG.

## Whitelist Pattern

The `/api/drive-file/[fileId]` proxy whitelists Drive files via two tables:

- `resource_media.file_id` — resources articles
- `post_attachments.drive_file_id` — news-feed posts

The proxy queries both in parallel and serves whichever returns the row. Without this whitelist, the proxy would be an open relay for any file the service account can see (domain-wide delegation).

**`drive_file_id` is the whitelist key, not `file_url`.** When inserting a `post_attachments` row, always set `drive_file_id` for image/document attachments. The `file_url` column stores the proxy path (`/api/drive-file/{id}`) and is what UI components render, but the whitelist check uses `drive_file_id` directly.

## Cleanup Flow

`deleteAttachmentFiles(driveFileIds)` is called when a post is deleted or attachments are removed during edit. It runs `deleteFileFromDrive` over every Drive file ID in parallel via `Promise.allSettled` and logs failures without throwing. Drive 404s are already swallowed inside `deleteFileFromDrive`.

**Order matters:** delete the DB row first, then the Drive file. If Drive deletion fails after the DB row is gone, we have an orphaned Drive file (cosmetic). The reverse — Drive file gone, DB row still present — would render as a broken image and is the worse failure mode.

## Auto Link Previews

When a post's content contains a URL and no link attachment is explicitly attached, `_fetchLinkPreviewInternal` extracts OG meta tags server-side. The preview image URL is proxied via `/api/og-image?url=...` (separate route with SSRF validation, image whitelist, 2 MB cap) so the CSP `img-src 'self'` can stay tight.

## Type Conventions

- `post_attachments.drive_file_id` is `string | null` (NULL for link attachments).
- `image_width` and `image_height` are `number | null` (NULL for documents and link previews).
- `attachment_type` is the `"image" | "document" | "link"` discriminator. Always check this before using `drive_file_id` or image dimensions.
