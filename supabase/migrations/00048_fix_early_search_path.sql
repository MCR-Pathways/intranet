-- Migration 00048: Fix missing SET search_path on early SECURITY DEFINER functions
--
-- Defence-in-depth: all these functions already use schema-qualified table
-- references (public.profiles, auth.uid()), so the risk is theoretical.
-- Adding SET search_path = '' improves upon the convention established
-- in later migrations (00037+ used 'public') and prevents any future risk
-- if unqualified references are added during edits.
--
-- Functions fixed:
--   00002: handle_new_user()
--   00003: is_hr_admin(), is_line_manager(), is_staff(), manages_user(), has_module_access()
--   00004: auto_enroll_required_courses()
--   00035: can_create_posts()

-- ==============================
-- handle_new_user (from 00002)
-- ==============================

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

  RETURN NEW;
END;
$$;

-- ==============================
-- is_hr_admin (from 00003)
-- ==============================

CREATE OR REPLACE FUNCTION public.is_hr_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_hr_admin = TRUE
  );
$$;

-- ==============================
-- is_line_manager (from 00003)
-- ==============================

CREATE OR REPLACE FUNCTION public.is_line_manager()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_line_manager = TRUE
  );
$$;

-- ==============================
-- is_staff (from 00003)
-- ==============================

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND user_type = 'staff'
  );
$$;

-- ==============================
-- manages_user (from 00003)
-- ==============================

CREATE OR REPLACE FUNCTION public.manages_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user_id AND line_manager_id = auth.uid()
  );
$$;

-- ==============================
-- has_module_access (from 00003)
-- ==============================

CREATE OR REPLACE FUNCTION public.has_module_access(p_module TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_user_type TEXT;
  v_status TEXT;
  v_induction_completed BOOLEAN;
BEGIN
  SELECT
    user_type,
    status,
    (induction_completed_at IS NOT NULL)
  INTO v_user_type, v_status, v_induction_completed
  FROM public.profiles
  WHERE id = auth.uid();

  -- Staff have full access to all modules
  IF v_user_type = 'staff' THEN
    RETURN TRUE;
  END IF;

  -- Pathways Coordinators: Intranet + Learning only (never HR or Sign-in)
  IF v_user_type = 'pathways_coordinator' THEN
    IF p_module IN ('intranet', 'learning') THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- New users: Check if staff or PC to determine access during induction
  IF v_user_type = 'new_user' THEN
    -- Induction module always accessible for new users
    IF p_module = 'induction' THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  RETURN FALSE;
END;
$$;

-- ==============================
-- auto_enroll_required_courses (from 00004, updated in 00024)
-- ==============================

CREATE OR REPLACE FUNCTION public.auto_enroll_required_courses()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  required_course RECORD;
  user_start_date DATE;
BEGIN
  -- Get user's start date
  SELECT start_date INTO user_start_date FROM public.profiles WHERE id = NEW.id;

  -- Loop through all required active courses and enrol user
  FOR required_course IN
    SELECT id, due_days_from_start
    FROM public.courses
    WHERE is_required = TRUE AND is_active = TRUE
  LOOP
    INSERT INTO public.course_enrolments (
      user_id,
      course_id,
      status,
      due_date
    )
    VALUES (
      NEW.id,
      required_course.id,
      'enrolled',
      CASE
        WHEN required_course.due_days_from_start IS NOT NULL AND user_start_date IS NOT NULL
        THEN user_start_date + required_course.due_days_from_start
        ELSE NULL
      END
    )
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ==============================
-- can_create_posts (from 00035)
-- ==============================

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
      AND user_type IN ('staff', 'pathways_coordinator')
  );
$$;
