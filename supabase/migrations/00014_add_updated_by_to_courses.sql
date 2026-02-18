-- Add updated_by column to track who last modified a course
DO $$ BEGIN
  ALTER TABLE public.courses
    ADD COLUMN updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
