-- Migration 00050: Add icon_colour to categories + merge "How-to Guides" into "Guides"
-- Part of Resources Overhaul PR 2

-- ─── Add icon_colour column ─────────────────────────────────────────────────
ALTER TABLE resource_categories
  ADD COLUMN IF NOT EXISTS icon_colour TEXT DEFAULT NULL;

-- ─── Merge "How-to Guides" into "Guides" ────────────────────────────────────
-- Move all articles from "How-to Guides" to "Guides", then soft-delete the category
DO $$
DECLARE
  v_guides_id UUID;
  v_howto_id UUID;
BEGIN
  SELECT id INTO v_guides_id FROM resource_categories WHERE slug = 'guides' AND deleted_at IS NULL;
  SELECT id INTO v_howto_id FROM resource_categories WHERE slug = 'how-to' AND deleted_at IS NULL;

  -- Only proceed if both categories exist
  IF v_guides_id IS NOT NULL AND v_howto_id IS NOT NULL THEN
    -- Move articles from How-to Guides to Guides
    UPDATE resource_articles
    SET category_id = v_guides_id, updated_at = NOW()
    WHERE category_id = v_howto_id AND deleted_at IS NULL;

    -- Soft-delete the How-to Guides category
    UPDATE resource_categories
    SET deleted_at = NOW(), deleted_by = NULL
    WHERE id = v_howto_id;

    -- Update Guides description to cover both
    UPDATE resource_categories
    SET description = 'Guides, how-to articles, and reference materials'
    WHERE id = v_guides_id;
  END IF;
END $$;
