-- ============================================================================
-- Migration: 00039_decouple_permissions_and_departments.sql
-- Description: Decouple admin permissions from department membership.
--
--   A. Backfill explicit admin flags for users currently auto-granted by dept
--   B. Simplify effective admin check functions (remove department OR clause)
--   C. Re-sync JWT claims for affected users
--   D. Create departments table for dynamic department management
--   E. Seed departments from current static config
-- ============================================================================

-- ============================================================================
-- A. BACKFILL EXPLICIT ADMIN FLAGS
--    Users in HR/L&D/Systems departments who relied on auto-grant now get
--    explicit flags. Run BEFORE changing functions — zero disruption.
-- ============================================================================

UPDATE public.profiles SET is_hr_admin = true
  WHERE department = 'hr' AND is_hr_admin = false AND status = 'active';

UPDATE public.profiles SET is_ld_admin = true
  WHERE department = 'learning_development' AND is_ld_admin = false AND status = 'active';

UPDATE public.profiles SET is_systems_admin = true
  WHERE department = 'systems' AND is_systems_admin = false AND status = 'active';

-- ============================================================================
-- B. SIMPLIFY EFFECTIVE ADMIN CHECK FUNCTIONS
--    Remove department OR clause. Admin access is now explicitly granted only.
--    Department = purely organisational (where you sit in the org chart).
-- ============================================================================

-- HR admin: only check is_hr_admin flag
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
      AND is_hr_admin = true
  );
$$;

-- L&D admin: only check is_ld_admin flag
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
      AND is_ld_admin = true
  );
$$;

-- Systems admin: only check is_systems_admin flag
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
      AND is_systems_admin = true
  );
$$;

-- ============================================================================
-- C. RE-SYNC JWT CLAIMS
--    Backfilled users need updated JWT claims so middleware picks up new flags.
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
WHERE auth.users.id = p.id
  AND (p.department IN ('hr', 'learning_development', 'systems'));

-- ============================================================================
-- D. CREATE DEPARTMENTS TABLE
--    Dynamic department management — HR admins can create/edit/deactivate.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  colour TEXT NOT NULL DEFAULT '#6b7280',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient dropdown queries (active departments sorted by sort_order)
CREATE INDEX IF NOT EXISTS idx_departments_active_sort
  ON public.departments (is_active, sort_order)
  WHERE is_active = true;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_departments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_departments_updated_at_trigger ON public.departments;
CREATE TRIGGER update_departments_updated_at_trigger
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_departments_updated_at();

-- RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read departments
DROP POLICY IF EXISTS "Authenticated users can view departments" ON public.departments;
CREATE POLICY "Authenticated users can view departments" ON public.departments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- HR admins can manage departments
DROP POLICY IF EXISTS "HR admins can insert departments" ON public.departments;
CREATE POLICY "HR admins can insert departments" ON public.departments
  FOR INSERT
  WITH CHECK (public.is_hr_admin());

DROP POLICY IF EXISTS "HR admins can update departments" ON public.departments;
CREATE POLICY "HR admins can update departments" ON public.departments
  FOR UPDATE
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

DROP POLICY IF EXISTS "HR admins can delete departments" ON public.departments;
CREATE POLICY "HR admins can delete departments" ON public.departments
  FOR DELETE
  USING (public.is_hr_admin());

-- ============================================================================
-- E. SEED DEPARTMENTS FROM CURRENT STATIC CONFIG
--    Uses ON CONFLICT to be idempotent.
-- ============================================================================

INSERT INTO public.departments (slug, name, colour, sort_order) VALUES
  ('executive',            'Executive',                   '#334155',  1),
  ('people',               'People',                      '#a855f7',  2),
  ('finance',              'Finance',                     '#22c55e',  3),
  ('delivery',             'Delivery',                    '#f97316',  4),
  ('development',          'Development',                 '#06b6d4',  5),
  ('engagement',           'Engagement & Influencing',    '#ec4899',  6),
  ('systems',              'Systems, Evidence & Impact',  '#64748b',  7),
  ('fundraising',          'Fundraising & Partnerships',  '#f59e0b',  8),
  ('communications',       'Communications & Policy',     '#f43f5e',  9),
  ('learning_development', 'Learning & Development',      '#6366f1', 10),
  ('hr',                   'HR',                          '#10b981', 11)
ON CONFLICT (slug) DO NOTHING;
