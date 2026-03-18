-- Migration 00058: Resources redesign schema changes
-- - Add content_type, Google Doc columns, component_name to resource_articles
-- - Create drive_folders table with RLS
-- - Update category depth trigger (2 → 3 levels)
-- - Hard-delete all existing articles (clean slate for Google Docs integration)
-- - Add GIN index on content column for full-text search

-- =============================================
-- 1. ADD COLUMNS TO resource_articles
-- =============================================

-- Content type discriminator: google_doc (synced from Drive) or component (React component)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resource_articles' AND column_name = 'content_type'
  ) THEN
    ALTER TABLE public.resource_articles
      ADD COLUMN content_type TEXT NOT NULL DEFAULT 'google_doc'
      CHECK (content_type IN ('google_doc', 'component'));
  END IF;
END $$;

-- Google Doc file ID (from Google Drive)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resource_articles' AND column_name = 'google_doc_id'
  ) THEN
    ALTER TABLE public.resource_articles ADD COLUMN google_doc_id TEXT;
  END IF;
END $$;

-- Full Google Docs URL for "Open in Google Docs" button
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resource_articles' AND column_name = 'google_doc_url'
  ) THEN
    ALTER TABLE public.resource_articles ADD COLUMN google_doc_url TEXT;
  END IF;
END $$;

-- Cached sanitised HTML from Google Docs export
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resource_articles' AND column_name = 'synced_html'
  ) THEN
    ALTER TABLE public.resource_articles ADD COLUMN synced_html TEXT;
  END IF;
END $$;

-- Timestamp of last successful sync from Google Docs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resource_articles' AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE public.resource_articles ADD COLUMN last_synced_at TIMESTAMPTZ;
  END IF;
END $$;

-- Component name for component-type articles (e.g. 'org-chart')
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resource_articles' AND column_name = 'component_name'
  ) THEN
    ALTER TABLE public.resource_articles ADD COLUMN component_name TEXT;
  END IF;
END $$;

-- Google Drive watch channel resource ID (for stopping webhook channels)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resource_articles' AND column_name = 'google_watch_resource_id'
  ) THEN
    ALTER TABLE public.resource_articles ADD COLUMN google_watch_resource_id TEXT;
  END IF;
END $$;

-- =============================================
-- 2. CREATE drive_folders TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.drive_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id TEXT NOT NULL,
  folder_url TEXT NOT NULL,
  name TEXT NOT NULL,
  registered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on Google Drive folder ID
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drive_folders_folder_id_key'
  ) THEN
    ALTER TABLE public.drive_folders ADD CONSTRAINT drive_folders_folder_id_key UNIQUE (folder_id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.drive_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for drive_folders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'drive_folders_select' AND tablename = 'drive_folders') THEN
    CREATE POLICY drive_folders_select ON public.drive_folders
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'drive_folders_insert' AND tablename = 'drive_folders') THEN
    CREATE POLICY drive_folders_insert ON public.drive_folders
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND (is_content_editor = true OR is_hr_admin = true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'drive_folders_delete' AND tablename = 'drive_folders') THEN
    CREATE POLICY drive_folders_delete ON public.drive_folders
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND (is_content_editor = true OR is_hr_admin = true)
        )
      );
  END IF;
END $$;

-- Updated_at trigger for drive_folders
CREATE OR REPLACE FUNCTION public.update_drive_folders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_drive_folders_updated_at ON public.drive_folders;
CREATE TRIGGER update_drive_folders_updated_at
  BEFORE UPDATE ON public.drive_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_drive_folders_updated_at();

-- =============================================
-- 3. UPDATE CATEGORY DEPTH TRIGGER (2 → 3 levels)
-- =============================================

CREATE OR REPLACE FUNCTION public.check_category_depth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  parent_depth INTEGER := 0;
  current_parent_id UUID;
BEGIN
  -- If no parent, depth is 0 (top-level) — always allowed
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Walk up the parent chain to calculate depth
  current_parent_id := NEW.parent_id;
  WHILE current_parent_id IS NOT NULL LOOP
    parent_depth := parent_depth + 1;

    -- Max 3 levels: top-level (0) → subcategory (1) → sub-subcategory (2)
    -- If the parent is already at depth 2, we can't add a child (would be depth 3)
    IF parent_depth > 2 THEN
      RAISE EXCEPTION 'Categories can only be nested up to 3 levels deep';
    END IF;

    SELECT rc.parent_id INTO current_parent_id
    FROM public.resource_categories rc
    WHERE rc.id = current_parent_id;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger already exists from migration 00055, function is replaced in place

-- =============================================
-- 4. HARD-DELETE ALL EXISTING ARTICLES (clean slate)
-- =============================================

DELETE FROM public.resource_articles;

-- =============================================
-- 5. FULL-TEXT SEARCH INDEX
-- =============================================

-- GIN index for full-text search on article content + title
-- Uses English text search configuration
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_resource_articles_fts'
  ) THEN
    CREATE INDEX idx_resource_articles_fts ON public.resource_articles
      USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));
  END IF;
END $$;
