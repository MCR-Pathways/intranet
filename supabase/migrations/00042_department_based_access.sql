-- ============================================================================
-- Migration: 00038_department_based_access.sql
-- Description: Department-based admin access model.
--
--   A. Add is_systems_admin column to profiles
--   B. Create effective admin check functions (single source of truth for RLS + server actions)
--   C. Create protect_admin_fields trigger (prevent self-promotion)
--   D. Update JWT claims sync to include department + is_systems_admin
--   E. Backfill existing users' JWT claims
-- ============================================================================

-- ============================================================================
-- A. ADD is_systems_admin COLUMN
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_systems_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- B. EFFECTIVE ADMIN CHECK FUNCTIONS
--    Single source of truth — called by RLS policies and server actions via RPC.
--    Department membership auto-grants access; manual boolean flags are overrides.
-- ============================================================================

-- HR admin: department = 'hr' OR is_hr_admin = true
CREATE OR REPLACE FUNCTION public.is_hr_admin_effective(p_user_id UUID DEFAULT auth.uid())
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
      AND (department = 'hr' OR is_hr_admin = true)
  );
$$;

-- L&D admin: department = 'learning_development' OR is_ld_admin = true
CREATE OR REPLACE FUNCTION public.is_ld_admin_effective(p_user_id UUID DEFAULT auth.uid())
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
      AND (department = 'learning_development' OR is_ld_admin = true)
  );
$$;

-- Systems admin: department = 'systems' OR is_systems_admin = true
CREATE OR REPLACE FUNCTION public.is_systems_admin_effective(p_user_id UUID DEFAULT auth.uid())
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
      AND (department = 'systems' OR is_systems_admin = true)
  );
$$;

-- ============================================================================
-- C. PROTECT ADMIN FIELDS TRIGGER
--    Prevents self-promotion and enforces that only HR admins can change
--    department and admin flags.
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
  END IF;

  -- Only effective HR admins can change department or grant HR admin
  IF NEW.department IS DISTINCT FROM OLD.department
     OR NEW.is_hr_admin IS DISTINCT FROM OLD.is_hr_admin THEN
    v_caller_is_hr_admin := public.is_hr_admin_effective(v_caller_id);
    IF NOT v_caller_is_hr_admin THEN
      RAISE EXCEPTION 'Only HR admins can change department or HR admin status';
    END IF;
  END IF;

  -- Only effective HR admins can grant systems admin
  IF NEW.is_systems_admin IS DISTINCT FROM OLD.is_systems_admin THEN
    v_caller_is_hr_admin := COALESCE(v_caller_is_hr_admin, public.is_hr_admin_effective(v_caller_id));
    IF NOT v_caller_is_hr_admin THEN
      RAISE EXCEPTION 'Only HR admins can change systems admin status';
    END IF;
  END IF;

  -- Only effective HR admins can grant L&D admin
  IF NEW.is_ld_admin IS DISTINCT FROM OLD.is_ld_admin THEN
    v_caller_is_hr_admin := COALESCE(v_caller_is_hr_admin, public.is_hr_admin_effective(v_caller_id));
    IF NOT v_caller_is_hr_admin THEN
      RAISE EXCEPTION 'Only HR admins can change L&D admin status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_admin_fields_trigger ON public.profiles;
CREATE TRIGGER protect_admin_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_admin_fields();

-- ============================================================================
-- D. UPDATE JWT CLAIMS SYNC
--    Add department and is_systems_admin to the JWT claims so middleware
--    can do cosmetic route checks without DB queries.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_profile_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Sync when middleware-relevant fields change
  IF (
    OLD.user_type IS DISTINCT FROM NEW.user_type OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.induction_completed_at IS DISTINCT FROM NEW.induction_completed_at OR
    OLD.department IS DISTINCT FROM NEW.department OR
    OLD.is_hr_admin IS DISTINCT FROM NEW.is_hr_admin OR
    OLD.is_ld_admin IS DISTINCT FROM NEW.is_ld_admin OR
    OLD.is_systems_admin IS DISTINCT FROM NEW.is_systems_admin
  ) THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'user_type', NEW.user_type,
      'status', NEW.status,
      'induction_completed_at', NEW.induction_completed_at,
      'department', NEW.department,
      'is_hr_admin', NEW.is_hr_admin,
      'is_ld_admin', NEW.is_ld_admin,
      'is_systems_admin', NEW.is_systems_admin
    )
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists from 00036 — just replacing the function body above

-- Also update handle_new_user to set the new claims
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_type TEXT;
  v_email TEXT;
BEGIN
  v_email := NEW.email;

  -- Validate email domain
  IF NOT v_email LIKE '%@mcrpathways.org' THEN
    RAISE EXCEPTION 'Only @mcrpathways.org email addresses are allowed';
  END IF;

  -- Default to pathways_coordinator (HR admin will upgrade to staff)
  v_user_type := 'pathways_coordinator';

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    user_type,
    status
  )
  VALUES (
    NEW.id,
    v_email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.raw_user_meta_data->>'avatar_url',
    v_user_type,
    'pending_induction'
  );

  -- Set initial JWT claims in raw_app_meta_data
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'user_type', v_user_type,
    'status', 'pending_induction',
    'induction_completed_at', NULL,
    'department', NULL,
    'is_hr_admin', false,
    'is_ld_admin', false,
    'is_systems_admin', false
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- E. BACKFILL EXISTING USERS' JWT CLAIMS
--    Add department, is_hr_admin, is_ld_admin, is_systems_admin to all existing JWTs.
-- ============================================================================

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
  'user_type', p.user_type,
  'status', p.status,
  'induction_completed_at', p.induction_completed_at,
  'department', p.department,
  'is_hr_admin', p.is_hr_admin,
  'is_ld_admin', p.is_ld_admin,
  'is_systems_admin', COALESCE(p.is_systems_admin, false)
)
FROM public.profiles p
WHERE auth.users.id = p.id;
