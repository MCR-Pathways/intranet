-- Migration 00069: Fix completion notification trigger to fire on INSERT OR UPDATE
-- Previously only fired on UPDATE, which meant direct inserts with status='completed'
-- (e.g. admin actions, data imports) would not trigger notifications.

DROP TRIGGER IF EXISTS trg_notify_course_completed ON public.course_enrolments;
CREATE TRIGGER trg_notify_course_completed
  AFTER INSERT OR UPDATE OF status ON public.course_enrolments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_course_completed();
