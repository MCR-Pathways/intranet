-- Schedule the daily reconcile that mirrors the live Chat hub catalogue into
-- native `courses` shells. Companion to 00100's hub-course schema.
--
-- Same pattern as 00093 (sweep-cleared-notifications) and 00086
-- (process-emails / daily-reminders): pg_cron + pg_net.http_get hitting an
-- authenticated Next.js route. The Vault secrets `cron_secret` and
-- `app_base_url` already exist from 00083 — nothing new to configure.
--
-- Schedule: daily at 05:30 UTC. Sequenced after the early-morning crons
-- (renew-drive-watches 03:00, sweep-staged-media 03:30, sweep-cleared
-- 04:00) so they don't contend for the same connection-pool slot.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-hub-courses') THEN
      PERFORM cron.unschedule('reconcile-hub-courses');
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron extension is not enabled.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net extension is not enabled.';
  END IF;
END $$;

SELECT cron.schedule(
  'reconcile-hub-courses',
  '30 5 * * *',
  $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/cron/reconcile-hub-courses',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    )
  );
  $cron$
);
