-- ============================================================================
-- Migration: 00055_resource_subcategories_visibility.sql
-- Description: Add subcategory support (parent_id) and visibility controls
--   to resource_categories and resource_articles.
--
--   Changes:
--   1. New column: resource_categories.parent_id (self-referential FK)
--   2. Depth constraint trigger: max 2 levels (parent → child, no grandchildren)
--   3. New column: resource_categories.visibility ('all' | 'internal')
--   4. New column: resource_articles.visibility (NULL = inherit from category)
--   5. Helper function: resolve_article_visibility()
--   6. Updated RLS policies: visibility-aware SELECT for regular users
--   7. Transitional data fix: existing categories set to 'all'
-- ============================================================================

-- ============================================================================
-- 1. Subcategory support
-- ============================================================================

ALTER TABLE public.resource_categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.resource_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resource_categories_parent
  ON public.resource_categories(parent_id);

-- ============================================================================
-- 2. Depth constraint trigger — max 2 levels
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_category_depth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- If no parent, depth is 0 (top-level) — always allowed
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check the parent is a top-level category (has no parent itself)
  IF EXISTS (
    SELECT 1 FROM public.resource_categories
    WHERE id = NEW.parent_id AND parent_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Subcategories can only be one level deep (no grandchildren)';
  END IF;

  -- Prevent a category from being its own parent
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A category cannot be its own parent';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_category_depth ON public.resource_categories;
CREATE TRIGGER enforce_category_depth
  BEFORE INSERT OR UPDATE OF parent_id ON public.resource_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.check_category_depth();

-- ============================================================================
-- 3. Visibility columns
-- ============================================================================

ALTER TABLE public.resource_categories
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'internal';

-- CHECK constraint (idempotent via exception handling)
DO $$
BEGIN
  ALTER TABLE public.resource_categories
    ADD CONSTRAINT resource_categories_visibility_check
    CHECK (visibility IN ('all', 'internal'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

ALTER TABLE public.resource_articles
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT NULL;

DO $$
BEGIN
  ALTER TABLE public.resource_articles
    ADD CONSTRAINT resource_articles_visibility_check
    CHECK (visibility IS NULL OR visibility IN ('all', 'internal'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

-- ============================================================================
-- 4. Helper function: resolve article visibility
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_article_visibility(
  p_article_visibility TEXT,
  p_category_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    p_article_visibility,
    (SELECT visibility FROM public.resource_categories WHERE id = p_category_id)
  );
$$;

-- ============================================================================
-- 5. Updated RLS policies — visibility-aware SELECT for regular users
-- ============================================================================

-- Categories: regular users see non-deleted, visibility-appropriate categories
DROP POLICY IF EXISTS "Authenticated users can read resource categories" ON public.resource_categories;
CREATE POLICY "Authenticated users can read resource categories"
  ON public.resource_categories FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (visibility = 'all' OR public.is_staff())
  );

-- Articles: regular users see published, non-deleted, visibility-appropriate articles
DROP POLICY IF EXISTS "Authenticated users can read published articles" ON public.resource_articles;
CREATE POLICY "Authenticated users can read published articles"
  ON public.resource_articles FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND deleted_at IS NULL
    AND (
      public.resolve_article_visibility(visibility, category_id) = 'all'
      OR public.is_staff()
    )
  );

-- Editor policies remain unchanged (editors see everything via 00053 policies)

-- ============================================================================
-- 6. Transitional data fix: set existing categories to 'all' so PCs keep access
-- ============================================================================

UPDATE public.resource_categories
SET visibility = 'all'
WHERE deleted_at IS NULL;
