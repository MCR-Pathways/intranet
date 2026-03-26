-- Replaces JS-side tag aggregation with a database function.
-- Returns the most frequently used tags across published Tool Shed entries.

CREATE OR REPLACE FUNCTION public.get_popular_tags(limit_count integer DEFAULT 20)
RETURNS TABLE(tag text, usage_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    unnest(t.tags) AS tag,
    count(*) AS usage_count
  FROM public.tool_shed_entries t
  WHERE t.is_published = true
    AND array_length(t.tags, 1) > 0
  GROUP BY tag
  ORDER BY usage_count DESC, tag ASC
  LIMIT limit_count;
$$;
