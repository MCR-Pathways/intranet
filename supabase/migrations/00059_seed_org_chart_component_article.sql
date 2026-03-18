-- Migration 00059: Seed org chart as a component article in Resources
-- Idempotent: only inserts if the article doesn't already exist

DO $$
DECLARE
  v_category_id UUID;
  v_existing_id UUID;
  v_author_id UUID;
BEGIN
  -- Find a valid author (first user in the system)
  SELECT id INTO v_author_id FROM auth.users LIMIT 1;
  IF v_author_id IS NULL THEN
    RAISE NOTICE 'No users found in auth.users — skipping org chart seed';
    RETURN;
  END IF;

  -- Find the Organisation category (seeded in migration 00056)
  SELECT id INTO v_category_id
  FROM public.resource_categories
  WHERE slug = 'organisation' AND deleted_at IS NULL
  LIMIT 1;

  IF v_category_id IS NULL THEN
    RAISE NOTICE 'Organisation category not found — skipping org chart seed';
    RETURN;
  END IF;

  -- Check if org chart article already exists
  SELECT id INTO v_existing_id
  FROM public.resource_articles
  WHERE slug = 'org-chart' AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Org chart article already exists (id: %) — skipping', v_existing_id;
    RETURN;
  END IF;

  -- Seed the org chart component article
  INSERT INTO public.resource_articles (
    category_id,
    title,
    slug,
    content,
    content_type,
    component_name,
    status,
    author_id,
    visibility
  ) VALUES (
    v_category_id,
    'Org Chart',
    'org-chart',
    'Interactive organisation chart showing team structure and reporting lines.',
    'component',
    'org-chart',
    'published',
    v_author_id,
    'all' -- Visible to all staff including external
  );

  RAISE NOTICE 'Org chart component article seeded successfully';
END $$;
