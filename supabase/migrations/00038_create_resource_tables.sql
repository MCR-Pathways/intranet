-- Migration 00034: Resources / Knowledge Base
-- Two-level hierarchy: resource_categories → resource_articles
-- HR admins create/edit/publish/delete; all authenticated users read published content.
-- Reuses update_updated_at_column() trigger function from migration 00002.

-- ============================================================================
-- 1. RESOURCE CATEGORIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.resource_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  description TEXT,
  icon        TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_categories_slug
  ON public.resource_categories(slug);

CREATE INDEX IF NOT EXISTS idx_resource_categories_sort
  ON public.resource_categories(sort_order, name);

-- ============================================================================
-- 2. RESOURCE ARTICLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.resource_articles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  UUID        NOT NULL REFERENCES public.resource_categories(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  slug         TEXT        NOT NULL,
  content      TEXT        NOT NULL DEFAULT '',
  content_json JSONB,
  status       TEXT        NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'published')),
  author_id    UUID        NOT NULL REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  UNIQUE(category_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_resource_articles_category
  ON public.resource_articles(category_id);

CREATE INDEX IF NOT EXISTS idx_resource_articles_status
  ON public.resource_articles(category_id, status);

-- GIN index on content for future full-text search (Phase 5)
CREATE INDEX IF NOT EXISTS idx_resource_articles_content_fts
  ON public.resource_articles
  USING gin(to_tsvector('english', content));

-- ============================================================================
-- 3. UPDATED_AT TRIGGERS (reuse function from migration 00002)
-- ============================================================================

DO $$ BEGIN
  CREATE TRIGGER update_resource_categories_updated_at
    BEFORE UPDATE ON public.resource_categories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_resource_articles_updated_at
    BEFORE UPDATE ON public.resource_articles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.resource_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_articles ENABLE ROW LEVEL SECURITY;

-- Categories: all authenticated users can read
DROP POLICY IF EXISTS "Authenticated users can read resource categories" ON public.resource_categories;
CREATE POLICY "Authenticated users can read resource categories"
  ON public.resource_categories FOR SELECT
  TO authenticated
  USING (true);

-- Categories: HR admins can insert
DROP POLICY IF EXISTS "HR admins can insert resource categories" ON public.resource_categories;
CREATE POLICY "HR admins can insert resource categories"
  ON public.resource_categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hr_admin());

-- Categories: HR admins can update
DROP POLICY IF EXISTS "HR admins can update resource categories" ON public.resource_categories;
CREATE POLICY "HR admins can update resource categories"
  ON public.resource_categories FOR UPDATE
  TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- Categories: HR admins can delete
DROP POLICY IF EXISTS "HR admins can delete resource categories" ON public.resource_categories;
CREATE POLICY "HR admins can delete resource categories"
  ON public.resource_categories FOR DELETE
  TO authenticated
  USING (public.is_hr_admin());

-- Articles: authenticated users can read PUBLISHED articles
DROP POLICY IF EXISTS "Authenticated users can read published articles" ON public.resource_articles;
CREATE POLICY "Authenticated users can read published articles"
  ON public.resource_articles FOR SELECT
  TO authenticated
  USING (status = 'published');

-- Articles: HR admins can read ALL articles (including drafts)
DROP POLICY IF EXISTS "HR admins can read all articles" ON public.resource_articles;
CREATE POLICY "HR admins can read all articles"
  ON public.resource_articles FOR SELECT
  TO authenticated
  USING (public.is_hr_admin());

-- Articles: HR admins can insert
DROP POLICY IF EXISTS "HR admins can insert resource articles" ON public.resource_articles;
CREATE POLICY "HR admins can insert resource articles"
  ON public.resource_articles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hr_admin());

-- Articles: HR admins can update
DROP POLICY IF EXISTS "HR admins can update resource articles" ON public.resource_articles;
CREATE POLICY "HR admins can update resource articles"
  ON public.resource_articles FOR UPDATE
  TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- Articles: HR admins can delete
DROP POLICY IF EXISTS "HR admins can delete resource articles" ON public.resource_articles;
CREATE POLICY "HR admins can delete resource articles"
  ON public.resource_articles FOR DELETE
  TO authenticated
  USING (public.is_hr_admin());

-- ============================================================================
-- 5. SEED DEFAULT CATEGORIES
-- ============================================================================

INSERT INTO public.resource_categories (name, slug, description, icon, sort_order)
VALUES
  ('Policies',      'policies',  'Company policies and procedures',              'Shield',   0),
  ('Guides',        'guides',    'Helpful guides and reference materials',        'BookOpen', 1),
  ('How-to Guides', 'how-to',    'Step-by-step instructions for common tasks',    'Wrench',   2),
  ('Templates',     'templates', 'Document and form templates',                   'FileText', 3)
ON CONFLICT (slug) DO NOTHING;
