-- Learning Overhaul: Tool Shed Social Learning Framework
-- Replaces the hardcoded static resources with a database-backed
-- social learning system (Digital Postcards, 3-2-1 Model, 10-Min Takeover).

-- ===========================================
-- 1. TOOL SHED ENTRIES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.tool_shed_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('postcard', 'three_two_one', 'takeover')),
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  event_name TEXT,
  event_date DATE,
  external_course_id UUID REFERENCES public.external_courses(id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Content JSONB structure by format:
--
-- Postcard:
-- {
--   "elevator_pitch": "In two sentences...",
--   "lightbulb_moment": "The one thing...",
--   "programme_impact": "How this helps...",
--   "golden_nugget": "One resource/technique..."
-- }
--
-- 3-2-1 Model:
-- {
--   "three_learned": ["Thing 1", "Thing 2", "Thing 3"],
--   "two_changes": ["Change 1", "Change 2"],
--   "one_question": "One question raised"
-- }
--
-- 10-Minute Takeover:
-- {
--   "useful_things": ["Most useful 1", "Most useful 2", "Most useful 3"]
-- }

CREATE INDEX IF NOT EXISTS idx_tool_shed_entries_user_id
  ON public.tool_shed_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_tool_shed_entries_format
  ON public.tool_shed_entries(format);

CREATE INDEX IF NOT EXISTS idx_tool_shed_entries_created_at
  ON public.tool_shed_entries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tool_shed_entries_tags
  ON public.tool_shed_entries USING GIN (tags);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER update_tool_shed_entries_updated_at
  BEFORE UPDATE ON public.tool_shed_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 2. RLS POLICIES
-- ===========================================

ALTER TABLE public.tool_shed_entries ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view published entries (organisation-wide)
DROP POLICY IF EXISTS "Anyone can view published entries" ON public.tool_shed_entries;
CREATE POLICY "Anyone can view published entries"
  ON public.tool_shed_entries FOR SELECT
  TO authenticated
  USING (is_published = TRUE);

-- Users can view own unpublished entries too
DROP POLICY IF EXISTS "Users can view own entries" ON public.tool_shed_entries;
CREATE POLICY "Users can view own entries"
  ON public.tool_shed_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can create entries
DROP POLICY IF EXISTS "Users can create entries" ON public.tool_shed_entries;
CREATE POLICY "Users can create entries"
  ON public.tool_shed_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update own entries
DROP POLICY IF EXISTS "Users can update own entries" ON public.tool_shed_entries;
CREATE POLICY "Users can update own entries"
  ON public.tool_shed_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Users can delete own entries
DROP POLICY IF EXISTS "Users can delete own entries" ON public.tool_shed_entries;
CREATE POLICY "Users can delete own entries"
  ON public.tool_shed_entries FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- L&D admins can manage all entries
DROP POLICY IF EXISTS "LD admins can manage all entries" ON public.tool_shed_entries;
CREATE POLICY "LD admins can manage all entries"
  ON public.tool_shed_entries FOR ALL
  TO authenticated
  USING (public.is_ld_admin_effective());

-- HR admins can manage all entries
DROP POLICY IF EXISTS "HR admins can manage all entries" ON public.tool_shed_entries;
CREATE POLICY "HR admins can manage all entries"
  ON public.tool_shed_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_hr_admin = TRUE
    )
  );
