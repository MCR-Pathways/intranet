-- Migration 00060: Full-text search RPC for resource articles
-- Uses PostgreSQL tsvector/tsquery with ts_headline for snippets

CREATE OR REPLACE FUNCTION public.search_resource_articles(
  search_query TEXT,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  content_type TEXT,
  category_name TEXT,
  category_slug TEXT,
  snippet TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    a.id,
    a.title,
    a.slug,
    a.content_type,
    c.name AS category_name,
    c.slug AS category_slug,
    COALESCE(
      ts_headline(
        'english',
        a.content,
        plainto_tsquery('english', search_query),
        'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=1'
      ),
      ''
    ) AS snippet,
    a.updated_at
  FROM public.resource_articles a
  JOIN public.resource_categories c ON c.id = a.category_id
  WHERE
    a.deleted_at IS NULL
    AND a.status = 'published'
    AND (
      to_tsvector('english', COALESCE(a.title, '') || ' ' || COALESCE(a.content, ''))
      @@ plainto_tsquery('english', search_query)
      OR a.title ILIKE '%' || search_query || '%'
    )
  ORDER BY
    ts_rank(
      to_tsvector('english', COALESCE(a.title, '') || ' ' || COALESCE(a.content, '')),
      plainto_tsquery('english', search_query)
    ) DESC,
    a.updated_at DESC
  LIMIT result_limit;
$$;
