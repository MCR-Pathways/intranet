-- Add a search_text column for full-text filtering of Tool Shed entries.
-- Populated by the server action on create/update using the same flattenContent() logic as Algolia.

ALTER TABLE public.tool_shed_entries
  ADD COLUMN IF NOT EXISTS search_text TEXT NOT NULL DEFAULT '';

-- Backfill existing entries
UPDATE public.tool_shed_entries
SET search_text = CASE format
  WHEN 'postcard' THEN
    coalesce(content->>'elevator_pitch', '') || ' ' ||
    coalesce(content->>'lightbulb_moment', '') || ' ' ||
    coalesce(content->>'programme_impact', '') || ' ' ||
    coalesce(content->>'golden_nugget', '')
  WHEN 'three_two_one' THEN
    coalesce((SELECT string_agg(elem, ' ') FROM jsonb_array_elements_text(content->'three_learned') AS elem), '') || ' ' ||
    coalesce((SELECT string_agg(elem, ' ') FROM jsonb_array_elements_text(content->'two_changes') AS elem), '') || ' ' ||
    coalesce(content->>'one_question', '')
  WHEN 'takeover' THEN
    coalesce((SELECT string_agg(elem, ' ') FROM jsonb_array_elements_text(content->'useful_things') AS elem), '')
  ELSE ''
END;
