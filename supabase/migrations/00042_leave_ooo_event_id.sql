-- =============================================
-- 00042: Add OOO Calendar event tracking to leave requests
-- =============================================
-- Stores the Google Calendar OOO event ID created when leave is approved,
-- so it can be deleted when leave is cancelled.

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS ooo_calendar_event_id TEXT;

COMMENT ON COLUMN public.leave_requests.ooo_calendar_event_id
  IS 'Google Calendar out-of-office event ID, created on approval, deleted on cancellation';
