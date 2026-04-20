-- Schedule the Drive watch renewal cron via Supabase pg_cron + pg_net.
-- Replaces the Vercel-cron approach used for process-emails and daily-reminders.
-- Going forward, new cron jobs are scheduled here, not in vercel.json.
--
-- ─── ONE-TIME SETUP (run manually in Supabase SQL editor before applying) ───
--
--   1. Enable extensions via Supabase Dashboard → Database → Extensions:
--        - pg_cron
--        - pg_net
--
--   2. Store the cron secret and base URL in Supabase Vault. In the SQL
--      editor, run (replacing the placeholder with the real CRON_SECRET env
--      var value used on Vercel):
--
--        SELECT vault.create_secret('REPLACE_WITH_CRON_SECRET', 'cron_secret');
--        SELECT vault.create_secret(
--          'https://intranet-nine-cyan.vercel.app',
--          'app_base_url'
--        );
--
--      If either secret already exists (e.g. re-applying), use
--      vault.update_secret(id, 'new_value') instead — look up the id with
--      SELECT id FROM vault.secrets WHERE name = 'cron_secret'.
--
--   3. Then apply this migration. It will fail clearly if the secrets are
--      missing when the cron fires (pg_net.http_get to a null URL), so
--      confirm both secrets exist via:
--        SELECT name FROM vault.secrets ORDER BY name;
--
-- ─── ROTATION ───
--
-- To rotate CRON_SECRET:
--   1. Update the Vercel env var.
--   2. Update the Supabase Vault secret:
--        SELECT vault.update_secret(
--          (SELECT id FROM vault.secrets WHERE name = 'cron_secret'),
--          'NEW_SECRET_VALUE'
--        );
-- Both must match or cron requests will 401.

-- Idempotent: unschedule existing job before re-scheduling, so re-applying
-- the migration (or updating the schedule later) is safe.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) AND EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'renew-drive-watches'
  ) THEN
    PERFORM cron.unschedule('renew-drive-watches');
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

-- Schedule: daily at 03:00 UTC. Non-overlapping with existing Vercel crons
-- (07:47 and 08:03 UTC).
SELECT cron.schedule(
  'renew-drive-watches',
  '0 3 * * *',
  $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/cron/renew-drive-watches',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    )
  );
  $cron$
);
