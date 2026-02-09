-- MCR Pathways Intranet - Induction Progress Table
-- Tracks which induction items a user has completed

-- ===========================================
-- INDUCTION PROGRESS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.induction_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_induction_progress_user_id ON public.induction_progress(user_id);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE public.induction_progress ENABLE ROW LEVEL SECURITY;

-- Users can view their own induction progress
DROP POLICY IF EXISTS "Users can view own induction progress" ON public.induction_progress;
CREATE POLICY "Users can view own induction progress"
ON public.induction_progress FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own induction progress
DROP POLICY IF EXISTS "Users can insert own induction progress" ON public.induction_progress;
CREATE POLICY "Users can insert own induction progress"
ON public.induction_progress FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- HR admins can view all induction progress
DROP POLICY IF EXISTS "HR admins can view all induction progress" ON public.induction_progress;
CREATE POLICY "HR admins can view all induction progress"
ON public.induction_progress FOR SELECT
TO authenticated
USING (public.is_hr_admin());
