-- Migration: Add draft/publish workflow to courses
-- New courses start as drafts. Admins build content, then publish when ready.
-- Learners only see published courses. is_active remains as a separate visibility toggle.

-- Add status column to courses
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'published'));

-- Backfill: currently active courses → published, inactive → draft
UPDATE courses SET status = 'published' WHERE is_active = true;
UPDATE courses SET status = 'draft' WHERE is_active = false;
