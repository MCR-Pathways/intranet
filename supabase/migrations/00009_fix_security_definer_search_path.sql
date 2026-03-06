-- Migration 00008: Fix SECURITY DEFINER functions missing search_path
-- Prevents search path hijacking by explicitly setting search_path = public
-- on both SECURITY DEFINER functions created in migration 00006.

CREATE OR REPLACE FUNCTION public.generate_weekly_roundup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_post_ids UUID[];
  v_roundup_id UUID;
  v_title TEXT;
  v_summary TEXT;
  v_post_count INTEGER;
  v_system_author_id UUID;
BEGIN
  -- Calculate current week boundaries (Monday to Sunday)
  v_week_start := date_trunc('week', CURRENT_DATE)::DATE;
  v_week_end := v_week_start + INTERVAL '6 days';

  -- Check if roundup already exists for this week
  IF EXISTS (SELECT 1 FROM public.weekly_roundups WHERE week_start = v_week_start) THEN
    RETURN;
  END IF;

  -- Get all post IDs from this week (excluding roundup posts)
  SELECT ARRAY_AGG(id ORDER BY created_at DESC)
  INTO v_post_ids
  FROM public.posts
  WHERE created_at >= v_week_start::TIMESTAMPTZ
    AND created_at < (v_week_end + INTERVAL '1 day')::TIMESTAMPTZ
    AND is_weekly_roundup = FALSE;

  v_post_count := COALESCE(array_length(v_post_ids, 1), 0);

  -- Build title and summary
  v_title := 'Weekly Round Up — ' ||
    to_char(v_week_start, 'DD Mon') || ' to ' ||
    to_char(v_week_end, 'DD Mon YYYY');

  v_summary := v_post_count || ' posts shared by the team this week.';

  -- Insert the roundup record
  INSERT INTO public.weekly_roundups (week_start, week_end, title, summary, post_ids, pinned_until)
  VALUES (
    v_week_start,
    v_week_end,
    v_title,
    v_summary,
    COALESCE(v_post_ids, '{}'),
    (v_week_start + INTERVAL '10 days')::TIMESTAMPTZ  -- Pinned until following Monday
  )
  RETURNING id INTO v_roundup_id;

  -- Find a system author (first HR admin)
  SELECT id INTO v_system_author_id
  FROM public.profiles
  WHERE is_hr_admin = TRUE
  ORDER BY created_at
  LIMIT 1;

  -- Only create the pinned post if we have an author
  IF v_system_author_id IS NOT NULL THEN
    INSERT INTO public.posts (author_id, content, is_pinned, is_weekly_roundup, weekly_roundup_id)
    VALUES (
      v_system_author_id,
      v_title || E'\n\n' || v_summary || E'\n\nCheck out the full round up to see everything from this week.',
      TRUE,
      TRUE,
      v_roundup_id
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.unpin_expired_roundups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts
  SET is_pinned = FALSE
  WHERE is_weekly_roundup = TRUE
    AND is_pinned = TRUE
    AND weekly_roundup_id IN (
      SELECT id FROM public.weekly_roundups
      WHERE pinned_until < NOW()
    );
END;
$$;
