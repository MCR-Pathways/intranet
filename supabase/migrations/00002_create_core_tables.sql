-- MCR Pathways Intranet - Core Tables
-- This migration creates the core tables: teams and profiles
-- Uses IF NOT EXISTS for idempotent execution

-- ===========================================
-- TEAMS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  parent_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for hierarchical queries
CREATE INDEX IF NOT EXISTS idx_teams_parent ON public.teams(parent_team_id);

-- ===========================================
-- PROFILES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.profiles (
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
  google_refresh_token TEXT, -- Will be encrypted in application layer
  induction_completed_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add team_lead_id to teams table (circular reference, added after profiles exists)
DO $$ BEGIN
  ALTER TABLE public.teams ADD COLUMN team_lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_profiles_line_manager_id ON public.profiles(line_manager_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- ===========================================
-- MANAGER TEAMS TABLE (for multi-team managers)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.manager_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(manager_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_manager_teams_manager ON public.manager_teams(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_teams_team ON public.manager_teams(team_id);

-- ===========================================
-- NOTIFICATIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.notifications (
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

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ===========================================
-- UPDATED_AT TRIGGER FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at (idempotent)
DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- HANDLE NEW USER FUNCTION
-- ===========================================

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

-- Trigger to auto-create profile on signup (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
