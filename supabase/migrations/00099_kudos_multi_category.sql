-- PR5a: Kudos moves from a single category to 1-2 categories.
--
-- The flowing-sentence redesign lets a kudos credit up to two values
-- ("…for going the extra mile and being a team player"). "Thank you"
-- stays exclusive — it has its own connector ("to say thank you"), so it
-- can never pair with another category.
--
-- Pre-launch: the handful of existing single-category kudos backfill
-- cleanly into one-element arrays before the old column is dropped.
-- Value validation (which of the six categories) stays in app code, as
-- it did for the single column — the CHECK enforces shape, not vocabulary.

-- 1. New ordered array column (holds 1-2 categories).
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS kudos_categories text[];

-- 2. Backfill existing single categories into one-element arrays.
--    Guarded so the migration stays idempotent after step 4 drops the
--    old column (a bare UPDATE would reference a missing column on re-run).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'kudos_category'
  ) THEN
    UPDATE public.posts
      SET kudos_categories = ARRAY[kudos_category]
      WHERE kudos_category IS NOT NULL
        AND kudos_categories IS NULL;
  END IF;
END $$;

-- 3. Replace the single-column consistency CHECK with the array one:
--    kudos posts carry 1-2 categories with "Thank you" exclusive; every
--    other post type carries none.
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_kudos_category_consistent;
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_kudos_categories_consistent;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_kudos_categories_consistent CHECK (
    (
      post_type = 'kudos'
      AND kudos_categories IS NOT NULL
      AND cardinality(kudos_categories) BETWEEN 1 AND 2
      AND NOT (
        'Thank you' = ANY (kudos_categories)
        AND cardinality(kudos_categories) > 1
      )
    )
    OR (
      post_type <> 'kudos'
      AND kudos_categories IS NULL
    )
  );

-- 4. Drop the superseded single column.
ALTER TABLE public.posts
  DROP COLUMN IF EXISTS kudos_category;

COMMENT ON COLUMN public.posts.kudos_categories IS
  'Kudos categories (1-2, ordered; "Thank you" exclusive). NULL for non-kudos posts, required when post_type = ''kudos''. Value validation lives in app code (KUDOS_CATEGORIES).';
