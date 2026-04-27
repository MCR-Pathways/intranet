-- News-feed media migration
--
-- Switches news-feed post attachments from Supabase Storage (post-attachments bucket)
-- to Google Drive (service account folder).
--
-- 1. Adds drive_file_id, image_width, image_height columns to post_attachments.
-- 2. Truncates existing image/document attachment rows (pre-launch — no real content).
-- 3. Drops the Supabase post-attachments bucket and its RLS policies.
--
-- After this migration runs, all news-feed media is uploaded to Drive via
-- uploadPostAttachment, served via /api/drive-file/[fileId], and identified
-- by drive_file_id rather than a Supabase Storage URL.

-- ============================================================================
-- 1. Schema: new columns on post_attachments
-- ============================================================================

ALTER TABLE public.post_attachments
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT;

ALTER TABLE public.post_attachments
  ADD COLUMN IF NOT EXISTS image_width INTEGER;

ALTER TABLE public.post_attachments
  ADD COLUMN IF NOT EXISTS image_height INTEGER;

-- Whitelist lookup index for the /api/drive-file/[fileId] proxy.
-- Partial index because link attachments have NULL drive_file_id.
CREATE INDEX IF NOT EXISTS post_attachments_drive_file_id_idx
  ON public.post_attachments (drive_file_id)
  WHERE drive_file_id IS NOT NULL;

-- ============================================================================
-- 2. Truncate existing image/document attachments
-- ============================================================================
-- Pre-launch: no real user content. Existing rows point at the bucket we're
-- about to drop, so they'd render as broken images. Link attachments stay.

DELETE FROM public.post_attachments
  WHERE attachment_type IN ('image', 'document');

-- ============================================================================
-- 3. Drop Supabase Storage bucket
-- ============================================================================

-- Storage RLS policies (created in migrations 00007 and 00035)
DROP POLICY IF EXISTS "Authenticated users can read post attachments" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload post attachments" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete own post attachments" ON storage.objects;

-- Clear any objects in the bucket before dropping it.
-- Supabase requires the bucket to be empty before deletion.
DELETE FROM storage.objects WHERE bucket_id = 'post-attachments';

-- Drop the bucket
DELETE FROM storage.buckets WHERE id = 'post-attachments';
