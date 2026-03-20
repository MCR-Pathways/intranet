-- Migration 00063: Learning Overhaul — Tool Shed & Email Notifications
-- Creates tool_shed_entries and email_notifications tables.
-- Already applied to production — added to repo for completeness.

-- ===========================================
-- TOOL SHED ENTRIES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.tool_shed_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  format TEXT NOT NULL
    CHECK (format IN ('postcard', 'three_two_one', 'takeover')),
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_shed_entries_user_id
  ON public.tool_shed_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_tool_shed_entries_course_id
  ON public.tool_shed_entries(course_id);

CREATE INDEX IF NOT EXISTS idx_tool_shed_entries_lesson_id
  ON public.tool_shed_entries(lesson_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_tool_shed_entries_updated_at ON public.tool_shed_entries;
CREATE TRIGGER update_tool_shed_entries_updated_at
  BEFORE UPDATE ON public.tool_shed_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- EMAIL NOTIFICATIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  metadata JSONB,
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_user_id
  ON public.email_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_email_notifications_email_type
  ON public.email_notifications(email_type);
