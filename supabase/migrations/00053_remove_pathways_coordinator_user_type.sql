-- ============================================================================
-- Migration: 00053_remove_pathways_coordinator_user_type.sql
-- Description: Remove pathways_coordinator from user_type. PCs (Pathways
--   Coordinators) are external users employed by schools/councils, not MCR
--   staff. The existing is_external boolean on profiles becomes the primary
--   classification mechanism. user_type becomes lifecycle-only: staff | new_user.
--
--   Target model:
--     MCR employee       → user_type='staff', is_external=false  (full access)
--     School-employed PC  → user_type='staff', is_external=true   (Learning + Intranet only)
--     New signup          → user_type='new_user', is_external=false (Induction only)
--
--   Changes:
--     1.  Data migration: pathways_coordinator → staff + is_external=true
--     2.  CHECK constraint: remove pathways_coordinator
--     3.  New function: is_internal_staff()
--     4.  Update: handle_new_user() — default new_user, restore JWT claims
--     5.  Update: sync_profile_claims() — add is_external
--     6.  Update: has_module_access() — use is_external
--     7.  Update: can_create_posts() — simplify to user_type='staff'
--     8.  Update: auto_enroll_from_assignment() — add is_external branch
--     9.  Update: notify_course_published() — add is_external branch
--     10. Update: course_assignments CHECK — add 'is_external'
--     11. Migrate existing PC course assignments
--     12. Update compliance_document_types applies_to arrays
--     13. Backfill JWT claims with is_external
-- ============================================================================


-- ============================================================================
-- 1. DATA MIGRATION
--    Convert all pathways_coordinator profiles to staff + external.
--    Must run BEFORE the CHECK constraint change.
-- ============================================================================

UPDATE public.profiles
SET user_type = 'staff', is_external = true
WHERE user_type = 'pathways_coordinator';


-- ============================================================================
-- 2. REPLACE CHECK CONSTRAINT
--    Remove pathways_coordinator from allowed values.
-- ============================================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_type_check
  CHECK (user_type IN ('staff', 'new_user'));


-- ============================================================================
-- 3. CREATE is_internal_staff()
--    Used by resource visibility RLS to gate 'internal' content.
--    External staff (PCs) should NOT see visibility='internal' content.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND user_type = 'staff'
      AND is_external = false
  );
$$;


-- ============================================================================
-- 4. UPDATE handle_new_user()
--    - Default to 'new_user' (not pathways_coordinator)
--    - Restore JWT claims update (regressed in migration 00048)
--    - Add is_external to initial JWT claims
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

  -- Default to new_user (HR admin assigns staff + is_external during onboarding)
  v_user_type := 'new_user';

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
    'is_systems_admin', false,
    'is_external', false
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;


-- ============================================================================
-- 5. UPDATE sync_profile_claims()
--    Add is_external to change detection and JWT sync.
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
    OLD.is_systems_admin IS DISTINCT FROM NEW.is_systems_admin OR
    OLD.is_external IS DISTINCT FROM NEW.is_external
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
      'is_external', NEW.is_external
    )
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================================
-- 6. UPDATE has_module_access()
--    Replace pathways_coordinator branch with is_external check.
--    External staff: Intranet + Learning only. Internal staff: full access.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_module_access(p_module TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_user_type TEXT;
  v_is_external BOOLEAN;
  v_status TEXT;
  v_induction_completed BOOLEAN;
BEGIN
  SELECT
    user_type,
    COALESCE(is_external, false),
    status,
    (induction_completed_at IS NOT NULL)
  INTO v_user_type, v_is_external, v_status, v_induction_completed
  FROM public.profiles
  WHERE id = auth.uid();

  -- Staff access
  IF v_user_type = 'staff' THEN
    IF v_is_external THEN
      -- External staff (PCs): Intranet + Learning only
      RETURN p_module IN ('intranet', 'learning');
    END IF;
    -- Internal staff: full access
    RETURN TRUE;
  END IF;

  -- New users: induction only
  IF v_user_type = 'new_user' THEN
    IF p_module = 'induction' THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  RETURN FALSE;
END;
$$;


-- ============================================================================
-- 7. UPDATE can_create_posts()
--    All staff (internal + external) can create posts.
--    Simplify from IN ('staff', 'pathways_coordinator') to = 'staff'.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_create_posts()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND user_type = 'staff'
  );
$$;


-- ============================================================================
-- 8. UPDATE auto_enroll_from_assignment()
--    Add is_external branch for course assignment matching.
--    Also fix search_path from 'public' to '' for consistency.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_enroll_from_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_user RECORD;
  course_due_days INTEGER;
BEGIN
  -- Get the course's due_days_from_start
  SELECT due_days_from_start INTO course_due_days
  FROM public.courses WHERE id = NEW.course_id;

  -- Find matching users based on assign_type
  FOR target_user IN
    SELECT p.id, p.start_date
    FROM public.profiles p
    WHERE p.status != 'inactive'
      AND (
        (NEW.assign_type = 'team' AND p.team_id = NEW.assign_value::UUID)
        OR
        (NEW.assign_type = 'user_type' AND p.user_type = NEW.assign_value)
        OR
        (NEW.assign_type = 'is_external' AND p.is_external = (NEW.assign_value = 'true'))
      )
  LOOP
    INSERT INTO public.course_enrolments (
      user_id, course_id, status, due_date
    ) VALUES (
      target_user.id,
      NEW.course_id,
      'enrolled',
      CASE
        WHEN course_due_days IS NOT NULL AND target_user.start_date IS NOT NULL
        THEN target_user.start_date + course_due_days
        ELSE NULL
      END
    )
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;


-- ============================================================================
-- 9. UPDATE notify_course_published()
--    Add is_external branch for notification targeting.
--    Also fix search_path from 'public' to '' for consistency.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_course_published(
  p_course_id UUID,
  p_published_by UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_course RECORD;
  v_notification_count INTEGER := 0;
  v_notification_type TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  -- Authorization: only L&D admins may trigger notifications
  IF NOT public.is_ld_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only L&D admins can send course notifications';
  END IF;

  -- Get course details
  SELECT id, title, is_required INTO v_course
  FROM public.courses
  WHERE id = p_course_id;

  IF v_course.id IS NULL THEN
    RETURN 0;
  END IF;

  -- Determine notification type based on whether course is required
  IF v_course.is_required THEN
    v_notification_type := 'mandatory_course';
    v_title := 'Required Course Available';
    v_message := v_course.title || ' is now available. This course is required — please complete it before the due date.';
  ELSE
    v_notification_type := 'new_course';
    v_title := 'New Course Available';
    v_message := v_course.title || ' is now available for enrolment.';
  END IF;

  -- Insert notifications for all matching users in a single statement.
  WITH new_notifications AS (
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    SELECT DISTINCT
      p.id,
      v_notification_type,
      v_title,
      v_message,
      '/learning/courses/' || p_course_id,
      jsonb_build_object('course_id', p_course_id)
    FROM public.course_assignments ca
    JOIN public.profiles p ON (
      (ca.assign_type = 'team' AND p.team_id = ca.assign_value::UUID)
      OR
      (ca.assign_type = 'user_type' AND p.user_type = ca.assign_value)
      OR
      (ca.assign_type = 'is_external' AND p.is_external = (ca.assign_value = 'true'))
    )
    WHERE ca.course_id = p_course_id
      AND p.status = 'active'
      AND p.id != p_published_by  -- Don't notify the publisher
    ON CONFLICT (user_id, (metadata->>'course_id'))
    WHERE metadata->>'course_id' IS NOT NULL
    DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_notification_count FROM new_notifications;

  RETURN v_notification_count;
END;
$$;


-- ============================================================================
-- 10. UPDATE course_assignments CHECK CONSTRAINT
--     Add 'is_external' as a valid assign_type.
-- ============================================================================

ALTER TABLE public.course_assignments
  DROP CONSTRAINT IF EXISTS course_assignments_assign_type_check;
ALTER TABLE public.course_assignments
  ADD CONSTRAINT course_assignments_assign_type_check
  CHECK (assign_type IN ('team', 'user_type', 'is_external'));


-- ============================================================================
-- 11. MIGRATE EXISTING PC COURSE ASSIGNMENTS
--     Convert assign_type='user_type' + assign_value='pathways_coordinator'
--     to assign_type='is_external' + assign_value='true'.
-- ============================================================================

UPDATE public.course_assignments
SET assign_type = 'is_external', assign_value = 'true'
WHERE assign_type = 'user_type' AND assign_value = 'pathways_coordinator';


-- ============================================================================
-- 12. UPDATE COMPLIANCE DOCUMENT TYPES
--     Remove 'pathways_coordinator' from applies_to arrays.
--     '{staff}' now covers all staff (internal + external).
-- ============================================================================

UPDATE public.compliance_document_types
SET applies_to = array_remove(applies_to, 'pathways_coordinator')
WHERE 'pathways_coordinator' = ANY(applies_to);


-- ============================================================================
-- 13. BACKFILL JWT CLAIMS WITH is_external
--     Add is_external to all existing users' JWT claims.
-- ============================================================================

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
  'user_type', p.user_type,
  'status', p.status,
  'induction_completed_at', p.induction_completed_at,
  'department', p.department,
  'is_hr_admin', p.is_hr_admin,
  'is_ld_admin', p.is_ld_admin,
  'is_systems_admin', COALESCE(p.is_systems_admin, false),
  'is_external', COALESCE(p.is_external, false)
)
FROM public.profiles p
WHERE auth.users.id = p.id;
