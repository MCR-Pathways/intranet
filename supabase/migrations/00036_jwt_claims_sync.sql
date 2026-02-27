-- ============================================================================
-- Migration: 00036_jwt_claims_sync.sql
-- Description: Eliminate the per-request DB query in middleware by syncing
--   user_type, status, and induction_completed_at from profiles into
--   auth.users.raw_app_meta_data (embedded in the JWT).
--
--   A. sync_profile_claims() trigger — keeps claims in sync on profile UPDATE
--   B. Updated handle_new_user() — sets initial claims on signup
--   C. Backfill — populates claims for all existing users
-- ============================================================================

-- ============================================================================
-- A. SYNC PROFILE CLAIMS TO JWT ON UPDATE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_profile_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only sync when the middleware-relevant fields actually change
  IF (
    OLD.user_type IS DISTINCT FROM NEW.user_type OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.induction_completed_at IS DISTINCT FROM NEW.induction_completed_at
  ) THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'user_type', NEW.user_type,
      'status', NEW.status,
      'induction_completed_at', NEW.induction_completed_at
    )
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_claims_trigger ON public.profiles;
CREATE TRIGGER sync_profile_claims_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_claims();

-- ============================================================================
-- B. UPDATE handle_new_user() TO SET INITIAL JWT CLAIMS
-- ============================================================================

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
    'induction_completed_at', NULL
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- C. BACKFILL EXISTING USERS
-- ============================================================================

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
  'user_type', p.user_type,
  'status', p.status,
  'induction_completed_at', p.induction_completed_at
)
FROM public.profiles p
WHERE auth.users.id = p.id;
