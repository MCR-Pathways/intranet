-- Move process-emails and daily-reminders from Vercel Cron to Supabase pg_cron.
-- Completes the migration started in 00083 (renew-drive-watches) so all three
-- app crons run under one scheduler.
--
-- ─── ONE-TIME SETUP ───
--
-- Vault secrets 'cron_secret' and 'app_base_url' already exist from 00083 —
-- nothing new to configure. Confirm via:
--   SELECT name FROM vault.secrets WHERE name IN ('cron_secret', 'app_base_url');
--
-- If either is missing, create them per the instructions in 00083 before
-- re-applying this migration. Otherwise pg_net will fire against a null URL
-- and silently no-op.
--
-- ─── POST-MERGE ───
--
-- Remove the matching entries from vercel.json in the same PR so Vercel
-- stops scheduling these routes. Both schedulers hitting the same path would
-- double up email sends.

-- Idempotent: unschedule existing jobs before re-scheduling, so re-applying
-- the migration (or updating a schedule later) is safe.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-emails') THEN
      PERFORM cron.unschedule('process-emails');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-reminders') THEN
      PERFORM cron.unschedule('daily-reminders');
    END IF;
  END IF;
END $$;

-- Guard: raise a clear error if extensions aren't enabled rather than
-- silently succeeding with no cron scheduled.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron extension is not enabled. Enable it via Supabase Dashboard → Database → Extensions, then re-apply this migration.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net extension is not enabled. Enable it via Supabase Dashboard → Database → Extensions, then re-apply this migration.';
  END IF;
END $$;

-- Schedule: daily-reminders at 07:47 UTC. Matches the previous Vercel schedule
-- so downstream timing (digest windows, user expectations) stays the same.
SELECT cron.schedule(
  'daily-reminders',
  '47 7 * * *',
  $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/cron/daily-reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    )
  );
  $cron$
);

-- Schedule: process-emails at 08:03 UTC — runs 16 minutes after daily-reminders
-- so any emails that failed during the digest burst get retried the same day.
SELECT cron.schedule(
  'process-emails',
  '3 8 * * *',
  $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/cron/process-emails',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    )
  );
  $cron$
);
