-- Restore email queue columns (dropped in 00065) and add email preferences.
-- The email_notifications table was simplified to an audit log in 00065;
-- this migration restores it as a processing queue with retry support.

-- ===========================================
-- 1. RESTORE QUEUE COLUMNS ON email_notifications
-- ===========================================

ALTER TABLE public.email_notifications
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS body_html TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT;

-- Add CHECK constraint for status (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_notifications_status_check'
  ) THEN
    ALTER TABLE public.email_notifications
      ADD CONSTRAINT email_notifications_status_check
      CHECK (status IN ('pending', 'processing', 'sent', 'failed'));
  END IF;
END $$;

-- Index for queue processing: find pending/failed emails efficiently
CREATE INDEX IF NOT EXISTS idx_email_notifications_queue
  ON public.email_notifications(status, created_at)
  WHERE status IN ('pending', 'failed');

-- Dedup index: prevent duplicate pending emails for same user+type+entity
-- Uses a coalesce to handle NULL entity_id (system-wide emails)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_notifications_dedup
  ON public.email_notifications(user_id, email_type, COALESCE(entity_id, ''))
  WHERE status IN ('pending', 'processing');

-- ===========================================
-- 2. EMAIL PREFERENCES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_email_preferences UNIQUE (user_id, email_type)
);

CREATE INDEX IF NOT EXISTS idx_email_preferences_user_id
  ON public.email_preferences(user_id);

-- RLS
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can view own email preferences'
      AND tablename = 'email_preferences'
  ) THEN
    CREATE POLICY "Users can view own email preferences"
      ON public.email_preferences FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can manage own email preferences'
      AND tablename = 'email_preferences'
  ) THEN
    CREATE POLICY "Users can manage own email preferences"
      ON public.email_preferences FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
