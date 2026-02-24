-- Migration 00026: Seed Default Compliance Document Types
-- Pre-populates the compliance_document_types table with the standard
-- documents MCR Pathways needs to track for staff and coordinators.
--
-- Uses ON CONFLICT to make this idempotent (safe to re-run).

INSERT INTO public.compliance_document_types (name, description, default_validity_months, alert_days_before_expiry, is_mandatory, applies_to)
VALUES
  (
    'PVG Disclosure (Scotland)',
    'Protecting Vulnerable Groups scheme membership — required for all staff working with young people in Scotland.',
    36,  -- 3 years
    '{90, 30, 7}',
    TRUE,
    '{staff, pathways_coordinator}'
  ),
  (
    'DBS Check (England)',
    'Disclosure and Barring Service enhanced check — required for all staff working with young people in England.',
    36,  -- 3 years
    '{90, 30, 7}',
    TRUE,
    '{staff, pathways_coordinator}'
  ),
  (
    'NSPCC Safeguarding Level 1',
    'NSPCC Child Protection Awareness foundation course.',
    36,  -- 3 years
    '{90, 30, 7}',
    TRUE,
    '{staff, pathways_coordinator}'
  ),
  (
    'NSPCC Safeguarding Level 2',
    'NSPCC Advanced Child Protection course — required for staff in direct contact roles.',
    36,  -- 3 years
    '{90, 30, 7}',
    FALSE,
    '{staff}'
  ),
  (
    'First Aid Certificate',
    'Qualified First Aider certificate — required for designated first aiders.',
    36,  -- 3 years
    '{90, 30, 7}',
    FALSE,
    '{staff}'
  ),
  (
    'Visa / Right to Work',
    'Evidence of right to work in the UK — visa, settled/pre-settled status, or passport.',
    NULL,  -- Variable — depends on visa type
    '{90, 60, 30, 7}',
    FALSE,
    '{staff, pathways_coordinator}'
  ),
  (
    'Driving Licence',
    'Full UK driving licence — required for roles involving travel between schools/regions.',
    NULL,  -- Variable — photo renewal every 10 years
    '{90, 30, 7}',
    FALSE,
    '{staff}'
  ),
  (
    'Professional Membership',
    'Professional body membership (e.g. CIPD, ACCA, SWE) — where required for role.',
    12,  -- 1 year
    '{60, 30, 7}',
    FALSE,
    '{staff}'
  ),
  (
    'Mental Health First Aid',
    'Mental Health First Aid certification.',
    36,  -- 3 years
    '{90, 30, 7}',
    FALSE,
    '{staff}'
  ),
  (
    'Food Hygiene Certificate',
    'Basic food hygiene certificate — for staff involved in events or catering.',
    36,  -- 3 years
    '{90, 30, 7}',
    FALSE,
    '{staff}'
  )
ON CONFLICT (name) DO NOTHING;
