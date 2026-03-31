-- Migration: 00073_resource_category_restructure.sql
-- Restructures resource categories for content migration from old WordPress intranet.
-- Soft-deletes unused subcategories, adds Scotland/England Programme subcategories
-- under Programme Resources, updates parent description.

-- ============================================================================
-- 1. SOFT-DELETE UNUSED SUBCATEGORIES
-- ============================================================================

-- Organisation > Supplier Directory (ditched)
UPDATE public.resource_categories
SET deleted_at = NOW()
WHERE slug = 'supplier-directory'
  AND deleted_at IS NULL;

-- Marketing & Comms > Pathways Pulse (ditched)
UPDATE public.resource_categories
SET deleted_at = NOW()
WHERE slug = 'pathways-pulse'
  AND deleted_at IS NULL;

-- Programme Resources > PC Guidebook (consolidated into Scotland/England Programme)
UPDATE public.resource_categories
SET deleted_at = NOW()
WHERE slug = 'pc-guidebook'
  AND deleted_at IS NULL;

-- Programme Resources > Key Documents (consolidated into Scotland/England Programme)
UPDATE public.resource_categories
SET deleted_at = NOW()
WHERE slug = 'key-documents'
  AND deleted_at IS NULL;

-- Programme Resources > Checklists (consolidated into Scotland/England Programme)
UPDATE public.resource_categories
SET deleted_at = NOW()
WHERE slug = 'checklists'
  AND deleted_at IS NULL;

-- ============================================================================
-- 2. INSERT SCOTLAND & ENGLAND PROGRAMME SUBCATEGORIES
-- ============================================================================

DO $$
DECLARE
  v_parent_id UUID;
BEGIN
  SELECT id INTO v_parent_id
  FROM public.resource_categories
  WHERE slug = 'programme-resources' AND deleted_at IS NULL;

  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.resource_categories (name, slug, description, parent_id, sort_order, visibility)
    VALUES
      ('Scotland Programme', 'scotland-programme', 'Group work, mentoring, participation forms, and PC induction resources for Scotland (S1-S6)', v_parent_id, 0, 'all'),
      ('England Programme',  'england-programme',  'Group work, mentoring, participation forms, and PC induction resources for England (Y7-Y12)', v_parent_id, 1, 'all')
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- 3. UPDATE PROGRAMME RESOURCES DESCRIPTION
-- ============================================================================

UPDATE public.resource_categories
SET description = 'Scotland and England programme delivery, mentor training, and young person engagement'
WHERE slug = 'programme-resources'
  AND deleted_at IS NULL;
