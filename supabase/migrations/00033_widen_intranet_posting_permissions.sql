-- Migration: Widen intranet posting permissions
-- Allow pathways_coordinator users to create posts, upload attachments, and fetch link previews.
-- Previously restricted to staff only.

-- Helper function: can the current user create posts?
-- Returns true for staff and active pathways_coordinators.
CREATE OR REPLACE FUNCTION public.can_create_posts()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND user_type IN ('staff', 'pathways_coordinator')
  );
$$;

-- 1. Widen INSERT policy on posts
DROP POLICY IF EXISTS "Staff can create posts" ON public.posts;
CREATE POLICY "Active users can create posts"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (public.can_create_posts());

-- 2. Widen INSERT policy on post_attachments
DROP POLICY IF EXISTS "Staff can create attachments" ON public.post_attachments;
CREATE POLICY "Active users can create attachments"
  ON public.post_attachments FOR INSERT
  TO authenticated
  WITH CHECK (public.can_create_posts());

-- 3. Widen INSERT policy on storage bucket
DROP POLICY IF EXISTS "Staff can upload post attachments" ON storage.objects;
CREATE POLICY "Active users can upload post attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'post-attachments' AND public.can_create_posts());
