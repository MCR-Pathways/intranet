-- Migration 00049: Resources soft-delete + featured articles
-- Adds deleted_at/deleted_by for soft-delete (30-day bin),
-- is_featured/featured_sort_order for pinning key resources to landing page,
-- and updates RLS policies to exclude soft-deleted records for non-admins.

-- ============================================================================
-- 1. Soft-delete columns
-- ============================================================================

ALTER TABLE public.resource_articles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.resource_categories
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id);

-- ============================================================================
-- 2. Featured article columns
-- ============================================================================

ALTER TABLE public.resource_articles
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_sort_order INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- 3. Partial indexes for non-deleted records (most queries filter on this)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_resource_articles_not_deleted
  ON public.resource_articles(category_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_resource_categories_not_deleted
  ON public.resource_categories(sort_order, name)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_resource_articles_featured
  ON public.resource_articles(featured_sort_order)
  WHERE is_featured = true AND deleted_at IS NULL;

-- ============================================================================
-- 4. Updated RLS policies
-- ============================================================================

-- Categories: regular users see only non-deleted
DROP POLICY IF EXISTS "Authenticated users can read resource categories" ON public.resource_categories;
CREATE POLICY "Authenticated users can read resource categories"
  ON public.resource_categories FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Categories: HR admins can read ALL (including soft-deleted, for bin view)
DROP POLICY IF EXISTS "HR admins can read all resource categories" ON public.resource_categories;
CREATE POLICY "HR admins can read all resource categories"
  ON public.resource_categories FOR SELECT
  TO authenticated
  USING (public.is_hr_admin());

-- Articles: regular users see only published + non-deleted
DROP POLICY IF EXISTS "Authenticated users can read published articles" ON public.resource_articles;
CREATE POLICY "Authenticated users can read published articles"
  ON public.resource_articles FOR SELECT
  TO authenticated
  USING (status = 'published' AND deleted_at IS NULL);

-- Articles: HR admins can read ALL (including drafts + soft-deleted)
DROP POLICY IF EXISTS "HR admins can read all articles" ON public.resource_articles;
CREATE POLICY "HR admins can read all articles"
  ON public.resource_articles FOR SELECT
  TO authenticated
  USING (public.is_hr_admin());
