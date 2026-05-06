-- Schedule the daily sweep that hard-deletes notifications cleared more
-- than 30 days ago. Companion to W3-rev.1b's auto-Clear behaviour.
--
-- Same pattern as 00086 (process-emails / daily-reminders) and 00088
-- (sweep-staged-media): pg_cron + pg_net.http_get hitting an
-- authenticated Next.js route. The Vault secrets `cron_secret` and
-- `app_base_url` already exist from 00083 — nothing new to configure.
--
-- Schedule: daily at 04:00 UTC. Sequenced after sweep-staged-media (03:30)
-- and renew-drive-watches (03:00) so the three early-morning crons don't
-- contend for the same connection-pool slot.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-cleared-notifications') THEN
      PERFORM cron.unschedule('sweep-cleared-notifications');
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
  'sweep-cleared-notifications',
  '0 4 * * *',
  $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/cron/sweep-cleared-notifications',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    )
  );
  $cron$
);
