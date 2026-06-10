-- ============================================================
-- 00098 — Drop over-permissive RLS write policies
-- ============================================================
--
-- A codebase security review (2026-06-10) found two RLS policies that
-- granted the `authenticated` role direct write access with
-- WITH CHECK (TRUE) / USING (TRUE). Because the legitimate writers
-- bypass RLS anyway, these policies only ever served to let any logged-in
-- user write rows directly via PostgREST.
--
-- 1. email_notifications — INSERT + UPDATE open to authenticated.
--    email_notifications is the outbound send queue drained by the
--    process-emails cron, which resolves the recipient from the row's
--    own metadata.recipient_email and sends verbatim via Resend from the
--    verified mcrpathways.co.uk domain. An authenticated user could queue
--    arbitrary email (any recipient, subject, body) and have it sent from
--    a trusted internal sender — an outbound phishing vector.
--    Legitimate writer: src/lib/email-queue.ts via the service-role client
--    (bypasses RLS).
--
-- 2. certificates — INSERT open to authenticated.
--    A user could insert a row asserting completion of mandatory
--    safeguarding/compliance training they never took, and download the
--    certificate PDF — defeating the training audit trail.
--    Legitimate writer: the generate_certificate_on_completion trigger,
--    which is SECURITY DEFINER (bypasses RLS).
--
-- Neither table needs an authenticated write policy. SELECT policies are
-- already correctly scoped (own rows + admins) and are left untouched.
-- Idempotent: DROP POLICY IF EXISTS is safe to re-run.
-- ============================================================

-- 1. email_notifications — remove authenticated INSERT and UPDATE
DROP POLICY IF EXISTS "System can insert email notifications" ON public.email_notifications;
DROP POLICY IF EXISTS "System can update email notifications" ON public.email_notifications;

-- 2. certificates — remove authenticated INSERT
DROP POLICY IF EXISTS "System can insert certificates" ON public.certificates;
