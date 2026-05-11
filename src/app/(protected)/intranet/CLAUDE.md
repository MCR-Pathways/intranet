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

- **Images and documents both 4 MB** (`IMAGE_MAX_SIZE_BYTES` / `DOCUMENT_MAX_SIZE_BYTES` in `src/lib/intranet.ts`). Constrained by **Vercel Hobby's 4.5 MB platform limit** on serverless function request bodies — that cap is enforced at Vercel's edge and cannot be raised by `bodySizeLimit` in `next.config.ts`.
- **`bodySizeLimit: "4mb"`** in `next.config.ts` matches the file caps.
- **Page-level `maxDuration = 60`** is set on `src/app/(protected)/intranet/page.tsx`. Server Actions invoked from the feed page inherit it.
- **REVISIT ON VERCEL PRO UPGRADE:** raise `IMAGE_MAX_SIZE_BYTES` and `DOCUMENT_MAX_SIZE_BYTES` to ~100 MB (`104857600`), and `bodySizeLimit` to `"100mb"`. Sharp pipeline already handles big files; only the platform cap is the constraint. iPhone ProRAW DNGs (40–80 MB) and larger photos will then work as originally planned. Tracked in `memory/news-feed-drive-media-backlog.md`.

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

## Document Preview (Lightbox)

Document attachments (`attachment_type = 'document'`) open in an in-app modal lightbox via `src/components/news-feed/document-lightbox.tsx`. Two render paths inside one component:

- **PDFs** (`mime_type === 'application/pdf'`): iframe loads our proxy URL (`/api/drive-file/{id}`). The proxy serves `Content-Disposition: inline` for PDFs (route handler in `src/app/api/drive-file/[fileId]/route.ts`). The browser's native PDF viewer renders inside — page nav, zoom, search, print all available via the viewer's own toolbar.
- **Non-PDFs** (DOCX, XLSX, PPTX, TXT, CSV): iframe loads Drive's `https://drive.google.com/file/d/{id}/preview` URL. Drive renders the document via its native viewer.

Three download paths exist for the same file:
1. Card-level download button — `<a href={proxy_url} download={filename}>`. Same proxy URL as the preview; the `download` attribute beats `Content-Disposition: inline` on Chrome and Firefox 82+ for same-origin URLs.
2. Chromium's PDF viewer toolbar inside the lightbox iframe (PDFs only) — built-in.
3. Drive's `/preview` header download button (non-PDFs) — built-in.

The lightbox itself adds no toolbar; that would duplicate buttons #2 / #3.

**Don't add `Content-Disposition: inline` for any other type without checking how the browser handles it.** DOCX/XLSX/PPTX would either show a download dialog or unreadable bytes — that's why non-PDFs go via Drive's `/preview` URL instead.

**Chromium PDF Open Parameters: `#toolbar=0` works, `#navpanes=0` doesn't.** PDFium implements `toolbar=0` (hides the top toolbar inside the iframe) but never implemented `navpanes=0` — that flag is Adobe-only. The bottom-right zoom widget stays visible regardless. Verified against the [Chromium issue tracker](https://issues.chromium.org/issues/40483153) and the [Helge Sverre PDF parameters reference](https://helgesver.re/articles/pdf-browser-parameters-reference). PR #280 settled on NOT applying the flag — keeping Chromium's full toolbar visible (familiar UX, page nav, search, zoom, download all built in) and dropping our parent toolbar instead.

**Chromium's PDF toolbar shows the PDF's `/Title` metadata, not the user's filename.** When a Google Doc is exported as PDF, the doc's title becomes the PDF's `/Title` metadata field. Chromium's PDF viewer prefers `/Title` over the URL or `Content-Disposition: filename`. Result: the user's chosen upload filename ("policy.pdf") doesn't appear in Chromium's toolbar; the doc's original title ("Links for resources") does. Two ways to fix: either hide Chromium's toolbar (loses familiar UX) or strip `/Title` at upload via `pdf-lib` (invasive — re-serialises the file, adds ~100ms). PR #280 accepted the metadata as-is rather than mutating the file.

**Drive `/preview` URL embedding needs the file domain-shared with the user's domain.** `https://drive.google.com/file/d/{id}/preview` is Drive's own viewer; it authenticates via the user's Google session, not our proxy. Without domain share at upload time the iframe shows Drive's "Request access" page. See **Domain-Share on Upload** below for the implementation and failure handling.

## Domain-Share on Upload

Every uploaded Drive file is shared with the `mcrpathways.org` domain (Reader role) inside `uploadPostAttachment` via `shareFileWithDomain` from `src/lib/google-drive-upload.ts`. This lets signed-in MCR users load Drive's `/preview` URL inside the document lightbox iframe — without domain share, Drive shows a "Request access" page to the user (proxy auth alone doesn't help for Drive's own viewer).

**Domain share is a hard requirement.** If `drive.permissions.create` fails, the upload is aborted and the just-uploaded Drive file is deleted. Better to fail upload than land a non-previewable document.

PDFs technically don't need domain share (proxy + inline disposition cover them). They're domain-shared anyway for consistency — saves a per-mime-type branch.

## File-Type Visual Convention

Document attachments signal their type via the established Adobe / Microsoft colour convention — Adobe Acrobat red for PDF, Word blue for DOC/DOCX, Excel green for XLSX/CSV, PowerPoint orange for PPT/PPTX, slate for TXT and unknown. Single source of truth: `src/lib/file-types.ts` (`FILE_TYPE_CONFIG` + `resolveFileType(mime, fileName)`). Documented in `docs/design-system.md` Section 1.9.

Used by:
- News-feed attachment card (`src/components/news-feed/attachment-display.tsx`)
- Composer chip (`src/components/news-feed/attachment-editor.tsx`)

The document lightbox itself does NOT consume `FILE_TYPE_CONFIG` — it has no toolbar, defers to Chromium's PDF viewer / Drive's `/preview` chrome inside the iframe.

Resources file element will adopt the same convention in a follow-up PR (tracked in `memory/news-feed-drive-media-backlog.md`).

**Never inline mime-to-colour logic anywhere else.** Call `resolveFileType(mime, fileName)` and consume `{ Icon, label, bgClass, fgClass }` from the returned config.

## Page Count

`post_attachments.page_count` and `news_feed_media.page_count` (both `INT NULL`) hold the PDF page count for the card meta line — `PDF · 12 pages · 230 KB`. Extracted at upload time via `unpdf` (pure JS, serverless-safe) inside `extractPdfPageCount` from `src/lib/pdf-metadata.ts`. Stays NULL for non-PDFs and for any PDF where extraction fails (corrupt or password-protected). The UI falls back to a size-only meta line when NULL.

Adding extraction for other types (DOCX page count via JSZip + parsing, etc.) is out of scope — `unpdf` handles only PDFs.

## Type Conventions

- `post_attachments.drive_file_id` is `string | null` (NULL for link attachments).
- `image_width` and `image_height` are `number | null` (NULL for documents and link previews).
- `page_count` is `number | null` (NULL for non-PDFs and extraction failures).
- `attachment_type` is the `"image" | "document" | "link"` discriminator. Always check this before using `drive_file_id` or image dimensions.

## Post-Type Discriminator (W4)

`posts.post_type` is a `text` column with a CHECK whitelist: `news / kudos / announcement / tool_shed_postcard / tool_shed_three_two_one / tool_shed_takeover`. Default is `'news'`. The three Tool Shed slots are pre-reserved so the W5 merge can be pure rendering (no schema PR). `'announcement'` is reserved but unused — W4b was attempted and scratched; see `memory/announcement-deferred.md`.

Type-specific data hangs off the `posts` row via additional optional columns:
- Kudos: `posts.kudos_category` (text, with a consistency CHECK — required when post_type='kudos', forbidden otherwise) + `post_kudos_recipients` join table for multi-recipient.
- Announcement (slot reserved but not built): would need a similar consistency-CHECK pattern for `announcement_expires_at`.

When adding a new post type:
1. Add the value to the `post_type` CHECK whitelist (new migration; the existing whitelist in 00095 lists current values).
2. Decide whether type-specific data goes inline (extra column with consistency CHECK) or in a separate table (join). Kudos uses both — `kudos_category` inline, recipients in a join.
3. Add the type to `POST_TYPES` in `src/lib/intranet.ts` and a type-guard (`isKudosCategory`-style) if there's an enum-shaped sub-value.
4. Branch the renderer in `PostCard` on the `post_type`. Single-signature visual accent (top strip + header badge) per the W4 design — avoid full-card chrome.
5. Add the new source kind to all five maps in `src/lib/notifications.ts` (`NOTIFICATION_SOURCE_KINDS`, `INFORMATIONAL_SOURCE_KINDS`, `SOURCE_KIND_REASON_LABEL`, `SOURCE_KIND_ICON`, `SOURCE_KIND_ACTION_VERB`, `SOURCE_KIND_MODULE`).

## Dialog Reuse Pattern for Post-Type Variants

When a post type needs both a compose flow AND an edit flow with locked fields, **reuse the same dialog with an optional `editTarget` prop** rather than forking a separate dialog. Mode is derived from `!!editTarget` — no enum, no `mode: "create" | "edit"` discriminator string.

The pattern (used in `KudosCreateDialog` for W4 + W4-edit):
1. Optional `editTarget?: T` prop carries the locked state — for kudos, the post id + category + existing recipients + original message.
2. State hydrates from `editTarget` on each open false→true transition via a `wasOpenRef` gate. Re-running on every open means a save → revalidation → reopen cycle picks up fresh server-side data even when the editTarget's primary key (e.g. postId) hasn't changed. The ref gate prevents re-hydration on parent re-renders that would otherwise stomp in-progress edits.
3. Locked field renders: muted-tone chip with a Lock icon in place of × (recipients), static chip without a picker (category). Editable fields render unchanged.
4. Submit branches: create-mode calls the create action; edit-mode runs the edit actions sequentially (see "Sequential, not parallel" in root CLAUDE.md — `editPost` + `addKudosRecipients` raced before the fix).
5. The same `reset()` callback hydrates from the editTarget in both directions (initial open + post-discard reset). The hydration `useEffect` body is just `reset()` — DRYs the duplicated state-setter block.

`editTarget` must be memoised on the parent side (`useMemo` keyed on the underlying post fields) so the dialog's `useMemo` deps and the hydration effect don't churn on every parent re-render. Inline object literals recreate on every render and break the gate.

Source-of-truth carrying: `editTarget` carries the FULL locked-row data (id + label + avatar + job_title for recipients), not just ids. A recipient who's been deactivated after the original kudos was sent still renders correctly in their locked chip because the data came from the kudos record, not the live mention list.

Reference: `src/components/news-feed/kudos-create-dialog.tsx`.
