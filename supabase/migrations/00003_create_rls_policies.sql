-- MCR Pathways Intranet - Row Level Security Policies
-- This migration sets up RLS for all core tables
-- Uses DROP IF EXISTS for idempotent execution

-- ===========================================
-- ENABLE RLS ON ALL TABLES
-- ===========================================

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

-- Check if current user is an HR admin
CREATE OR REPLACE FUNCTION public.is_hr_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_hr_admin = TRUE
  );
$$;

-- Check if current user is a line manager
CREATE OR REPLACE FUNCTION public.is_line_manager()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_line_manager = TRUE
  );
$$;

-- Check if current user is staff
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND user_type = 'staff'
  );
$$;

-- Check if user manages another user
CREATE OR REPLACE FUNCTION public.manages_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user_id AND line_manager_id = auth.uid()
  );
$$;

-- Check module access
CREATE OR REPLACE FUNCTION public.has_module_access(p_module TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
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

-- ===========================================
-- TEAMS POLICIES (idempotent)
-- ===========================================

-- Anyone authenticated can view teams
DROP POLICY IF EXISTS "Teams are viewable by authenticated users" ON public.teams;
CREATE POLICY "Teams are viewable by authenticated users"
ON public.teams FOR SELECT
TO authenticated
USING (true);

-- Only HR admins can manage teams
DROP POLICY IF EXISTS "HR admins can insert teams" ON public.teams;
CREATE POLICY "HR admins can insert teams"
ON public.teams FOR INSERT
TO authenticated
WITH CHECK (public.is_hr_admin());

DROP POLICY IF EXISTS "HR admins can update teams" ON public.teams;
CREATE POLICY "HR admins can update teams"
ON public.teams FOR UPDATE
TO authenticated
USING (public.is_hr_admin())
WITH CHECK (public.is_hr_admin());

DROP POLICY IF EXISTS "HR admins can delete teams" ON public.teams;
CREATE POLICY "HR admins can delete teams"
ON public.teams FOR DELETE
TO authenticated
USING (public.is_hr_admin());

-- ===========================================
-- PROFILES POLICIES (idempotent)
-- ===========================================

-- Everyone can view basic profile info
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Users can update their own profile (limited fields)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  -- Prevent users from changing their own admin/manager status
  AND (
    COALESCE(is_hr_admin, FALSE) = (SELECT is_hr_admin FROM public.profiles WHERE id = auth.uid())
    AND COALESCE(is_line_manager, FALSE) = (SELECT is_line_manager FROM public.profiles WHERE id = auth.uid())
    AND user_type = (SELECT user_type FROM public.profiles WHERE id = auth.uid())
  )
);

-- HR admins can update any profile
DROP POLICY IF EXISTS "HR admins can update any profile" ON public.profiles;
CREATE POLICY "HR admins can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_hr_admin());

-- ===========================================
-- MANAGER TEAMS POLICIES (idempotent)
-- ===========================================

-- Managers can see their own team associations
DROP POLICY IF EXISTS "Managers can view own team associations" ON public.manager_teams;
CREATE POLICY "Managers can view own team associations"
ON public.manager_teams FOR SELECT
TO authenticated
USING (manager_id = auth.uid() OR public.is_hr_admin());

-- Only HR admins can manage team associations
DROP POLICY IF EXISTS "HR admins can manage team associations" ON public.manager_teams;
CREATE POLICY "HR admins can manage team associations"
ON public.manager_teams FOR ALL
TO authenticated
USING (public.is_hr_admin())
WITH CHECK (public.is_hr_admin());

-- ===========================================
-- NOTIFICATIONS POLICIES (idempotent)
-- ===========================================

-- Users can only view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can update (mark as read) their own notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- System can create notifications for any user (via service role)
-- Note: This is handled by service role, not through RLS

-- Users can delete their own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (user_id = auth.uid());
