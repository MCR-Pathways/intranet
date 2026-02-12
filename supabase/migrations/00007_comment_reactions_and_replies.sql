-- Migration 00007: Comment reactions and threaded replies
-- Adds: comment_reactions table, parent_id column on post_comments

-- =====================================================================
-- 1. Add parent_id to post_comments for threaded replies (single level)
-- =====================================================================

DO $$ BEGIN
  ALTER TABLE public.post_comments
    ADD COLUMN parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON public.post_comments (parent_id);

-- =====================================================================
-- 2. Create comment_reactions table
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'celebrate', 'insightful', 'curious')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- =====================================================================
-- 3. Indexes for comment_reactions
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON public.comment_reactions (comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user_id ON public.comment_reactions (user_id);

-- =====================================================================
-- 4. RLS policies for comment_reactions
-- =====================================================================

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view comment reactions" ON public.comment_reactions;
CREATE POLICY "Authenticated users can view comment reactions"
  ON public.comment_reactions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can add comment reactions" ON public.comment_reactions;
CREATE POLICY "Authenticated users can add comment reactions"
  ON public.comment_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own comment reactions" ON public.comment_reactions;
CREATE POLICY "Users can update own comment reactions"
  ON public.comment_reactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove own comment reactions" ON public.comment_reactions;
CREATE POLICY "Users can remove own comment reactions"
  ON public.comment_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
