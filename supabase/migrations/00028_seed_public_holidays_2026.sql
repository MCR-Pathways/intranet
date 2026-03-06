-- Migration 00027: Seed Public Holidays for 2026
-- MCR Pathways operates in both Scotland and England, which have
-- different public holiday calendars. These are used to calculate
-- working days for leave requests.
--
-- Sources:
--   Scotland: https://www.gov.scot/publications/public-and-bank-holidays/
--   England: https://www.gov.uk/bank-holidays
--
-- Uses ON CONFLICT to make this idempotent (safe to re-run).

-- ===========================================
-- SHARED HOLIDAYS (apply to both Scotland and England)
-- ===========================================

INSERT INTO public.public_holidays (name, holiday_date, region, year) VALUES
  ('New Year''s Day',         '2026-01-01', 'all', 2026),
  ('Good Friday',             '2026-04-03', 'all', 2026),
  ('Christmas Day',           '2026-12-25', 'all', 2026),
  ('Boxing Day (substitute)', '2026-12-28', 'all', 2026)  -- 26 Dec is Saturday, observed Monday
ON CONFLICT (holiday_date, region) DO NOTHING;

-- ===========================================
-- SCOTLAND-SPECIFIC HOLIDAYS
-- ===========================================

INSERT INTO public.public_holidays (name, holiday_date, region, year) VALUES
  ('2nd January',                    '2026-01-02', 'scotland', 2026),
  ('Easter Monday',                  '2026-04-06', 'scotland', 2026),  -- Not a statutory holiday in Scotland but commonly observed
  ('Early May Bank Holiday',         '2026-05-04', 'scotland', 2026),
  ('Spring Bank Holiday',            '2026-05-25', 'scotland', 2026),
  ('Summer Bank Holiday (Scotland)', '2026-08-03', 'scotland', 2026),  -- First Monday in August
  ('St Andrew''s Day',               '2026-11-30', 'scotland', 2026)
ON CONFLICT (holiday_date, region) DO NOTHING;

-- ===========================================
-- ENGLAND-SPECIFIC HOLIDAYS
-- ===========================================

INSERT INTO public.public_holidays (name, holiday_date, region, year) VALUES
  ('Easter Monday',                  '2026-04-06', 'england', 2026),
  ('Early May Bank Holiday',         '2026-05-04', 'england', 2026),
  ('Spring Bank Holiday',            '2026-05-25', 'england', 2026),
  ('Summer Bank Holiday (England)',  '2026-08-31', 'england', 2026)   -- Last Monday in August
ON CONFLICT (holiday_date, region) DO NOTHING;
