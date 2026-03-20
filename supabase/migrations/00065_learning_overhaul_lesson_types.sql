-- Migration 00065_learning_overhaul_lesson_types.sql

-- 1. Add new columns to course_lessons
ALTER TABLE public.course_lessons
ADD COLUMN IF NOT EXISTS content_json JSONB,
ADD COLUMN IF NOT EXISTS slides_url TEXT;

-- 2. Update the check constraint for lesson_type
-- The existing constraint might check for IN ('text', 'video')
-- We need to drop it and recreate it with the new values.
-- Since constraint names can vary, we find and drop the trigger/constraint or simply apply a new constraint if possible.
-- Alternatively, we can drop the specific constraint.
DO $$
DECLARE
  conname TEXT;
BEGIN
  SELECT constraint_name INTO conname
  FROM information_schema.constraint_column_usage
  WHERE table_name = 'course_lessons' AND column_name = 'lesson_type';

  IF conname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.course_lessons DROP CONSTRAINT ' || quote_ident(conname);
  END IF;
END $$;

-- Add the new constraint
ALTER TABLE public.course_lessons
ADD CONSTRAINT course_lessons_lesson_type_check 
CHECK (lesson_type IN ('text', 'video', 'slides', 'rich_text'));

-- 3. We also need to update any types in RPCs or Views if applicable, but `lesson_type` is just a text column with a constraint.
