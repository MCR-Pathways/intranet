-- Migration: Add image attachments for text lessons
-- Admins can upload images to text lessons, displayed as a gallery below content.

-- Create lesson_images table
CREATE TABLE IF NOT EXISTS lesson_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INT NOT NULL,
  mime_type TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_images_lesson_id ON lesson_images(lesson_id);

-- RLS
ALTER TABLE lesson_images ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view images for active lessons
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'lesson_images_select' AND tablename = 'lesson_images'
  ) THEN
    CREATE POLICY lesson_images_select ON lesson_images
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- LD/HR admin full CRUD
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'lesson_images_insert_admin' AND tablename = 'lesson_images'
  ) THEN
    CREATE POLICY lesson_images_insert_admin ON lesson_images
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_ld_admin = true OR is_hr_admin = true))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'lesson_images_delete_admin' AND tablename = 'lesson_images'
  ) THEN
    CREATE POLICY lesson_images_delete_admin ON lesson_images
      FOR DELETE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_ld_admin = true OR is_hr_admin = true))
      );
  END IF;
END $$;

-- Create storage bucket for lesson images (public, 5MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lesson-images',
  'lesson-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: LD/HR admin upload + delete, authenticated read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'lesson_images_storage_read' AND tablename = 'objects'
    AND schemaname = 'storage'
  ) THEN
    CREATE POLICY lesson_images_storage_read ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'lesson-images');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'lesson_images_storage_insert' AND tablename = 'objects'
    AND schemaname = 'storage'
  ) THEN
    CREATE POLICY lesson_images_storage_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'lesson-images'
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_ld_admin = true OR is_hr_admin = true))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'lesson_images_storage_delete' AND tablename = 'objects'
    AND schemaname = 'storage'
  ) THEN
    CREATE POLICY lesson_images_storage_delete ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'lesson-images'
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_ld_admin = true OR is_hr_admin = true))
      );
  END IF;
END $$;
