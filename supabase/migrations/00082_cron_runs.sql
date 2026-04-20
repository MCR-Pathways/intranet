-- Audit table for cron job runs. Written by route handlers in
-- src/app/api/cron/*/route.ts — each run INSERTs a 'running' row on start and
-- UPDATEs with status/result/error on finish. Gives us SQL-queryable run
-- history that is owned by the app (not the Supabase pg_cron system tables).
--
-- RLS is enabled with no policies — service role (used by cron handlers) can
-- write; no other role can read. An HR-admin SELECT policy can be added
-- later when an admin dashboard surfaces the data.

CREATE TABLE IF NOT EXISTS public.cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  result JSONB,
  error TEXT
);

CREATE INDEX IF NOT EXISTS cron_runs_job_started_idx
  ON public.cron_runs (job_name, started_at DESC);

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
