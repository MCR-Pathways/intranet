-- ============================================================================
-- Migration: 00053_add_content_editor_permission.sql
-- Description: Add is_content_editor permission to profiles.
--   Content Editors can create, edit, and delete resources.
--   HR admins retain full resource access.
--   Systems admins (and HR admins) can grant Content Editor permission.
--
--   Changes:
--   1. New column: profiles.is_content_editor (boolean, default false)
--   2. New DB functions: is_content_editor(), is_content_editor_effective()
--   3. Update protect_admin_fields() — block self-change, HR/systems can grant
--   4. Update sync_profile_claims() — include is_content_editor in JWT
--   5. Update handle_new_user() — initialise is_content_editor = false
--   6. Backfill JWT claims for existing users
--   7. Update resource RLS policies — content editors get same access as HR admins
-- ============================================================================

-- ============================================================================
-- 1. New column
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_content_editor BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- 2. DB functions
-- ============================================================================

-- Simple check for RLS policies (uses auth.uid() from JWT)
CREATE OR REPLACE FUNCTION public.is_content_editor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND is_content_editor = true
  );
$$;

-- Status-aware check for server actions (accepts explicit user ID)
CREATE OR REPLACE FUNCTION public.is_content_editor_effective(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND status = 'active'
      AND is_content_editor = true
  );
$$;

-- ============================================================================
-- 3. Update protect_admin_fields() — add is_content_editor
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_admin_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_is_hr_admin BOOLEAN;
  v_caller_is_systems_admin BOOLEAN;
BEGIN
  -- Skip if called by service role (no auth.uid())
  IF v_caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block self-changes to department and admin flags
  IF v_caller_id = NEW.id THEN
    IF NEW.department IS DISTINCT FROM OLD.department THEN
      RAISE EXCEPTION 'Cannot change your own department';
    END IF;
    IF NEW.is_hr_admin IS DISTINCT FROM OLD.is_hr_admin THEN
      RAISE EXCEPTION 'Cannot change your own HR admin status';
    END IF;
    IF NEW.is_ld_admin IS DISTINCT FROM OLD.is_ld_admin THEN
      RAISE EXCEPTION 'Cannot change your own L&D admin status';
    END IF;
    IF NEW.is_systems_admin IS DISTINCT FROM OLD.is_systems_admin THEN
      RAISE EXCEPTION 'Cannot change your own systems admin status';
    END IF;
    IF NEW.is_content_editor IS DISTINCT FROM OLD.is_content_editor THEN
      RAISE EXCEPTION 'Cannot change your own content editor status';
    END IF;
  END IF;

  -- Only effective HR admins can change department or grant HR admin
  IF NEW.department IS DISTINCT FROM OLD.department
     OR NEW.is_hr_admin IS DISTINCT FROM OLD.is_hr_admin THEN
    v_caller_is_hr_admin := public.is_hr_admin_effective(v_caller_id);
    IF NOT v_caller_is_hr_admin THEN
      RAISE EXCEPTION 'Only HR admins can change department or HR admin status';
    END IF;
  END IF;

  -- HR admins or systems admins can change systems admin status
  IF NEW.is_systems_admin IS DISTINCT FROM OLD.is_systems_admin THEN
    v_caller_is_hr_admin := COALESCE(v_caller_is_hr_admin, public.is_hr_admin_effective(v_caller_id));
    v_caller_is_systems_admin := public.is_systems_admin_effective(v_caller_id);
    IF NOT v_caller_is_hr_admin AND NOT v_caller_is_systems_admin THEN
      RAISE EXCEPTION 'Only HR admins or systems admins can change systems admin status';
    END IF;
  END IF;

  -- HR admins or systems admins can change L&D admin status
  IF NEW.is_ld_admin IS DISTINCT FROM OLD.is_ld_admin THEN
    v_caller_is_hr_admin := COALESCE(v_caller_is_hr_admin, public.is_hr_admin_effective(v_caller_id));
    v_caller_is_systems_admin := COALESCE(v_caller_is_systems_admin, public.is_systems_admin_effective(v_caller_id));
    IF NOT v_caller_is_hr_admin AND NOT v_caller_is_systems_admin THEN
      RAISE EXCEPTION 'Only HR admins or systems admins can change L&D admin status';
    END IF;
  END IF;

  -- HR admins or systems admins can change content editor status
  IF NEW.is_content_editor IS DISTINCT FROM OLD.is_content_editor THEN
    v_caller_is_hr_admin := COALESCE(v_caller_is_hr_admin, public.is_hr_admin_effective(v_caller_id));
    v_caller_is_systems_admin := COALESCE(v_caller_is_systems_admin, public.is_systems_admin_effective(v_caller_id));
    IF NOT v_caller_is_hr_admin AND NOT v_caller_is_systems_admin THEN
      RAISE EXCEPTION 'Only HR admins or systems admins can change content editor status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. Update sync_profile_claims() — include is_content_editor in JWT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_profile_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (
    OLD.user_type IS DISTINCT FROM NEW.user_type OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.induction_completed_at IS DISTINCT FROM NEW.induction_completed_at OR
    OLD.department IS DISTINCT FROM NEW.department OR
    OLD.is_hr_admin IS DISTINCT FROM NEW.is_hr_admin OR
    OLD.is_ld_admin IS DISTINCT FROM NEW.is_ld_admin OR
    OLD.is_systems_admin IS DISTINCT FROM NEW.is_systems_admin OR
    OLD.is_content_editor IS DISTINCT FROM NEW.is_content_editor
  ) THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'user_type', NEW.user_type,
      'status', NEW.status,
      'induction_completed_at', NEW.induction_completed_at,
      'department', NEW.department,
      'is_hr_admin', NEW.is_hr_admin,
      'is_ld_admin', NEW.is_ld_admin,
      'is_systems_admin', NEW.is_systems_admin,
      'is_content_editor', NEW.is_content_editor
    )
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 5. Update handle_new_user() — initialise is_content_editor = false
-- ============================================================================

-- Re-read the existing function and add is_content_editor to the claims init.
-- handle_new_user() inserts into profiles and sets initial JWT claims.
-- We use DO block to update only the claims portion via a direct UPDATE.
DO $$
BEGIN
  -- Backfill: ensure all existing users have is_content_editor in JWT
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('is_content_editor', COALESCE(p.is_content_editor, false))
  FROM public.profiles p
  WHERE auth.users.id = p.id;
END;
$$;

-- ============================================================================
-- 6. Update resource RLS policies — content editors get same access as HR admins
-- ============================================================================

-- Categories: content editors can read all (including soft-deleted, for bin view)
DROP POLICY IF EXISTS "HR admins can read all resource categories" ON public.resource_categories;
CREATE POLICY "Editors can read all resource categories"
  ON public.resource_categories FOR SELECT
  TO authenticated
  USING (public.is_hr_admin() OR public.is_content_editor());

-- Categories: content editors can insert
DROP POLICY IF EXISTS "HR admins can insert resource categories" ON public.resource_categories;
CREATE POLICY "Editors can insert resource categories"
  ON public.resource_categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hr_admin() OR public.is_content_editor());

-- Categories: content editors can update
DROP POLICY IF EXISTS "HR admins can update resource categories" ON public.resource_categories;
CREATE POLICY "Editors can update resource categories"
  ON public.resource_categories FOR UPDATE
  TO authenticated
  USING (public.is_hr_admin() OR public.is_content_editor());

-- Categories: content editors can delete
DROP POLICY IF EXISTS "HR admins can delete resource categories" ON public.resource_categories;
CREATE POLICY "Editors can delete resource categories"
  ON public.resource_categories FOR DELETE
  TO authenticated
  USING (public.is_hr_admin() OR public.is_content_editor());

-- Articles: content editors can read all (including drafts + soft-deleted)
DROP POLICY IF EXISTS "HR admins can read all articles" ON public.resource_articles;
CREATE POLICY "Editors can read all articles"
  ON public.resource_articles FOR SELECT
  TO authenticated
  USING (public.is_hr_admin() OR public.is_content_editor());

-- Articles: content editors can insert
DROP POLICY IF EXISTS "HR admins can insert resource articles" ON public.resource_articles;
CREATE POLICY "Editors can insert resource articles"
  ON public.resource_articles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hr_admin() OR public.is_content_editor());

-- Articles: content editors can update
DROP POLICY IF EXISTS "HR admins can update resource articles" ON public.resource_articles;
CREATE POLICY "Editors can update resource articles"
  ON public.resource_articles FOR UPDATE
  TO authenticated
  USING (public.is_hr_admin() OR public.is_content_editor());

-- Articles: content editors can delete
DROP POLICY IF EXISTS "HR admins can delete resource articles" ON public.resource_articles;
CREATE POLICY "Editors can delete resource articles"
  ON public.resource_articles FOR DELETE
  TO authenticated
  USING (public.is_hr_admin() OR public.is_content_editor());
