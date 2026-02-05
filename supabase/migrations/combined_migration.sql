-- ============================================
-- MCR Pathways Intranet - Combined Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- ===========================================
-- PART 1: ENUM TYPES
-- ===========================================

-- User type enum
CREATE TYPE user_type AS ENUM (
  'staff',
  'pathways_coordinator',
  'new_user'
);

-- User status enum
CREATE TYPE user_status AS ENUM (
  'active',
  'inactive',
  'pending_induction'
);

-- Leave type enum
CREATE TYPE leave_type AS ENUM (
  'annual',
  'sick',
  'compassionate',
  'parental',
  'toil',
  'unpaid',
  'study',
  'jury_duty'
);

-- Leave status enum
CREATE TYPE leave_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

-- Work location enum
CREATE TYPE work_location AS ENUM (
  'home',
  'glasgow_office',
  'stevenage_office',
  'other'
);

-- Course category enum
CREATE TYPE course_category AS ENUM (
  'compliance',
  'upskilling',
  'soft_skills'
);

-- ===========================================
-- PART 2: CORE TABLES
-- ===========================================

-- TEAMS TABLE
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  parent_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teams_parent ON public.teams(parent_team_id);

-- PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  preferred_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  job_title TEXT,
  user_type user_type NOT NULL DEFAULT 'new_user',
  status user_status NOT NULL DEFAULT 'pending_induction',
  start_date DATE,
  is_line_manager BOOLEAN DEFAULT FALSE,
  is_hr_admin BOOLEAN DEFAULT FALSE,
  line_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  google_calendar_connected BOOLEAN DEFAULT FALSE,
  google_refresh_token TEXT,
  induction_completed_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add team_lead_id to teams table
ALTER TABLE public.teams ADD COLUMN team_lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_user_type ON public.profiles(user_type);
CREATE INDEX idx_profiles_team_id ON public.profiles(team_id);
CREATE INDEX idx_profiles_line_manager_id ON public.profiles(line_manager_id);
CREATE INDEX idx_profiles_status ON public.profiles(status);

-- MANAGER TEAMS TABLE
CREATE TABLE public.manager_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(manager_id, team_id)
);

CREATE INDEX idx_manager_teams_manager ON public.manager_teams(manager_id);
CREATE INDEX idx_manager_teams_team ON public.manager_teams(team_id);

-- NOTIFICATIONS TABLE
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- HANDLE NEW USER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_user_type user_type;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ===========================================
-- PART 3: ROW LEVEL SECURITY
-- ===========================================

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- HELPER FUNCTIONS
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

CREATE OR REPLACE FUNCTION public.has_module_access(p_module TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_user_type user_type;
  v_status user_status;
  v_induction_completed BOOLEAN;
BEGIN
  SELECT
    user_type,
    status,
    (induction_completed_at IS NOT NULL)
  INTO v_user_type, v_status, v_induction_completed
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_user_type = 'staff' THEN
    RETURN TRUE;
  END IF;

  IF v_user_type = 'pathways_coordinator' THEN
    IF p_module IN ('intranet', 'learning') THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  IF v_user_type = 'new_user' THEN
    IF p_module = 'induction' THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  RETURN FALSE;
END;
$$;

-- TEAMS POLICIES
CREATE POLICY "Teams are viewable by authenticated users"
ON public.teams FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "HR admins can insert teams"
ON public.teams FOR INSERT
TO authenticated
WITH CHECK (public.is_hr_admin());

CREATE POLICY "HR admins can update teams"
ON public.teams FOR UPDATE
TO authenticated
USING (public.is_hr_admin())
WITH CHECK (public.is_hr_admin());

CREATE POLICY "HR admins can delete teams"
ON public.teams FOR DELETE
TO authenticated
USING (public.is_hr_admin());

-- PROFILES POLICIES
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    COALESCE(is_hr_admin, FALSE) = (SELECT is_hr_admin FROM public.profiles WHERE id = auth.uid())
    AND COALESCE(is_line_manager, FALSE) = (SELECT is_line_manager FROM public.profiles WHERE id = auth.uid())
    AND user_type = (SELECT user_type FROM public.profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "HR admins can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_hr_admin());

-- MANAGER TEAMS POLICIES
CREATE POLICY "Managers can view own team associations"
ON public.manager_teams FOR SELECT
TO authenticated
USING (manager_id = auth.uid() OR public.is_hr_admin());

CREATE POLICY "HR admins can manage team associations"
ON public.manager_teams FOR ALL
TO authenticated
USING (public.is_hr_admin())
WITH CHECK (public.is_hr_admin());

-- NOTIFICATIONS POLICIES
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
