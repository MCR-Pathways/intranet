-- Migration 00076: Add native article support for Plate editor
-- - Expand content_type CHECK to include 'native'
-- - Add CHECK: native articles must have content_json
-- - Add last_published_at for publish timestamp tracking
-- - Add editing_by/editing_at for concurrent editing warning

-- =============================================
-- 1. UPDATE content_type CHECK CONSTRAINT
-- =============================================

-- content_json JSONB column already exists (created in 00038_create_resource_tables.sql)
-- Just need to expand the content_type constraint to allow 'native'

DO $$ BEGIN
  -- Drop the existing CHECK constraint (name from migration 00058)
  ALTER TABLE public.resource_articles
    DROP CONSTRAINT IF EXISTS resource_articles_content_type_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

ALTER TABLE public.resource_articles
  ADD CONSTRAINT resource_articles_content_type_check
  CHECK (content_type IN ('google_doc', 'component', 'native'));

-- =============================================
-- 2. NATIVE ARTICLES MUST HAVE content_json
-- =============================================

ALTER TABLE public.resource_articles
  DROP CONSTRAINT IF EXISTS native_articles_require_content_json;

ALTER TABLE public.resource_articles
  ADD CONSTRAINT native_articles_require_content_json
  CHECK (content_type != 'native' OR content_json IS NOT NULL);

-- =============================================
-- 3. ADD last_published_at
-- =============================================
-- updated_at changes on every auto-save. last_published_at tracks
-- when the article was last made public (publish/republish).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'resource_articles'
      AND column_name = 'last_published_at'
  ) THEN
    ALTER TABLE public.resource_articles
      ADD COLUMN last_published_at TIMESTAMPTZ;
  END IF;
END $$;

-- =============================================
-- 4. ADD CONCURRENT EDITING FIELDS
-- =============================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'resource_articles'
      AND column_name = 'editing_by'
  ) THEN
    ALTER TABLE public.resource_articles
      ADD COLUMN editing_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'resource_articles'
      AND column_name = 'editing_at'
  ) THEN
    ALTER TABLE public.resource_articles
      ADD COLUMN editing_at TIMESTAMPTZ;
  END IF;
END $$;
