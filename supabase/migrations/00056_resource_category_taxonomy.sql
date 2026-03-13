-- Migration: 00056_resource_category_taxonomy.sql
-- Replaces the 3 placeholder categories (Policies, Guides, Templates) with
-- a 9-category taxonomy organised by function. 43 subcategories seeded.
-- All categories start with visibility = 'all'. Editable via UI.

-- ============================================================================
-- 1. SOFT-DELETE OLD CATEGORIES AND THEIR ARTICLES
-- ============================================================================

-- Soft-delete articles in old categories first (constraint: can't delete category with articles)
UPDATE public.resource_articles
SET deleted_at = NOW()
WHERE category_id IN (
  SELECT id FROM public.resource_categories
  WHERE slug IN ('policies', 'guides', 'templates', 'how-to')
    AND deleted_at IS NULL
)
AND deleted_at IS NULL;

-- Soft-delete old categories ('how-to' was renamed from 'guides' by migration 00050)
UPDATE public.resource_categories
SET deleted_at = NOW()
WHERE slug IN ('policies', 'guides', 'templates', 'how-to')
  AND deleted_at IS NULL;

-- ============================================================================
-- 2. CREATE 9 TOP-LEVEL CATEGORIES
-- ============================================================================

INSERT INTO public.resource_categories (name, slug, description, icon, icon_colour, sort_order, visibility)
VALUES
  ('Organisation',               'organisation',               'Mission, values, structure, and organisational information',                  'Building2',       'teal',       0, 'all'),
  ('Policies & Compliance',      'policies-compliance',        'Employment policies, health & safety, safeguarding, and data protection',     'ShieldCheck',     'wine',       1, 'all'),
  ('IT & Digital',               'it-digital',                 'IT policies, cyber security, AI, and digital tools',                          'Laptop',          'light-blue', 2, 'all'),
  ('Marketing & Comms',          'marketing-comms',            'Communications, social media, press, and marketing resources',                'Megaphone',       'pink',       3, 'all'),
  ('Finance & Governance',       'finance-governance',         'Financial procedures, governance, and accounts',                              'Landmark',        'green',      4, 'all'),
  ('People & Benefits',          'people-benefits',            'People services, benefits, appraisals, and new staff information',            'HeartHandshake',  'orange',     5, 'all'),
  ('Programme Resources',        'programme-resources',        'PC guidebooks, mentor training, and young person resources',                  'BookMarked',      NULL,         6, 'all'),
  ('Fundraising & Partnerships', 'fundraising-partnerships',   'Fundraising, partnerships, and public affairs',                              'HandHelping',     'grey',       7, 'all'),
  ('Templates & Forms',          'templates-forms',            'Cross-cutting templates, expense forms, and request forms',                   'FileText',        'teal',       8, 'all')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 3. CREATE SUBCATEGORIES
-- ============================================================================

-- Helper: insert subcategories for a parent by slug.
-- Uses a DO block so we can look up parent IDs by slug.

DO $$
DECLARE
  v_parent_id UUID;
BEGIN

  -- ── Organisation (8 subcategories) ──────────────────────────────────────
  SELECT id INTO v_parent_id FROM public.resource_categories WHERE slug = 'organisation' AND deleted_at IS NULL;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.resource_categories (name, slug, parent_id, sort_order, visibility)
    VALUES
      ('Mission, Vision & Values', 'mission-vision-values',  v_parent_id, 0, 'all'),
      ('Strategy',                 'strategy',               v_parent_id, 1, 'all'),
      ('Org Structure',            'org-structure',           v_parent_id, 2, 'all'),
      ('MCR''s DNA',               'mcrs-dna',               v_parent_id, 3, 'all'),
      ('Jargon Buster',            'jargon-buster',           v_parent_id, 4, 'all'),
      ('Impact Report',            'impact-report',           v_parent_id, 5, 'all'),
      ('FAQ',                      'faq',                     v_parent_id, 6, 'all'),
      ('Supplier Directory',       'supplier-directory',      v_parent_id, 7, 'all')
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  -- ── Policies & Compliance (6 subcategories) ────────────────────────────
  SELECT id INTO v_parent_id FROM public.resource_categories WHERE slug = 'policies-compliance' AND deleted_at IS NULL;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.resource_categories (name, slug, parent_id, sort_order, visibility)
    VALUES
      ('Employment Policies',  'employment-policies',  v_parent_id, 0, 'all'),
      ('Health & Safety',      'health-safety',        v_parent_id, 1, 'all'),
      ('Safeguarding',         'safeguarding',         v_parent_id, 2, 'all'),
      ('Data Protection',      'data-protection',      v_parent_id, 3, 'all'),
      ('Whistleblowing',       'whistleblowing',       v_parent_id, 4, 'all'),
      ('Expenses Policy',      'expenses-policy',      v_parent_id, 5, 'all')
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  -- ── IT & Digital (4 subcategories) ─────────────────────────────────────
  SELECT id INTO v_parent_id FROM public.resource_categories WHERE slug = 'it-digital' AND deleted_at IS NULL;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.resource_categories (name, slug, parent_id, sort_order, visibility)
    VALUES
      ('IT Policy',                  'it-policy',                  v_parent_id, 0, 'all'),
      ('Cyber Security',             'cyber-security',             v_parent_id, 1, 'all'),
      ('AI Policy, Training & FAQs', 'ai-policy-training-faqs',   v_parent_id, 2, 'all'),
      ('Pathfinder Guides',          'pathfinder-guides',          v_parent_id, 3, 'all')
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  -- ── Marketing & Comms (7 subcategories) ────────────────────────────────
  SELECT id INTO v_parent_id FROM public.resource_categories WHERE slug = 'marketing-comms' AND deleted_at IS NULL;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.resource_categories (name, slug, parent_id, sort_order, visibility)
    VALUES
      ('Social Media Policy',  'social-media-policy',  v_parent_id, 0, 'all'),
      ('Press Protocol',       'press-protocol',       v_parent_id, 1, 'all'),
      ('Marketing Toolkit',    'marketing-toolkit',    v_parent_id, 2, 'all'),
      ('External Comms',       'external-comms',       v_parent_id, 3, 'all'),
      ('Crisis Comms',         'crisis-comms',         v_parent_id, 4, 'all'),
      ('Comms Calendars',      'comms-calendars',      v_parent_id, 5, 'all'),
      ('Pathways Pulse',       'pathways-pulse',       v_parent_id, 6, 'all')
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  -- ── Finance & Governance (3 subcategories) ─────────────────────────────
  SELECT id INTO v_parent_id FROM public.resource_categories WHERE slug = 'finance-governance' AND deleted_at IS NULL;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.resource_categories (name, slug, parent_id, sort_order, visibility)
    VALUES
      ('Financial Procedures',  'financial-procedures',  v_parent_id, 0, 'all'),
      ('Board of Trustees',     'board-of-trustees',     v_parent_id, 1, 'all'),
      ('Accounts',              'accounts',              v_parent_id, 2, 'all')
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  -- ── People & Benefits (6 subcategories) ────────────────────────────────
  SELECT id INTO v_parent_id FROM public.resource_categories WHERE slug = 'people-benefits' AND deleted_at IS NULL;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.resource_categories (name, slug, parent_id, sort_order, visibility)
    VALUES
      ('People Services',       'people-services',       v_parent_id, 0, 'all'),
      ('121 & Appraisal Guide', '121-appraisal-guide',   v_parent_id, 1, 'all'),
      ('Pension',               'pension',               v_parent_id, 2, 'all'),
      ('Life Assurance',        'life-assurance',        v_parent_id, 3, 'all'),
      ('EAP',                   'eap',                   v_parent_id, 4, 'all'),
      ('New Staff Info',        'new-staff-info',        v_parent_id, 5, 'all')
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  -- ── Programme Resources (6 subcategories) ──────────────────────────────
  SELECT id INTO v_parent_id FROM public.resource_categories WHERE slug = 'programme-resources' AND deleted_at IS NULL;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.resource_categories (name, slug, parent_id, sort_order, visibility)
    VALUES
      ('PC Guidebook',             'pc-guidebook',             v_parent_id, 0, 'all'),
      ('Key Documents',            'key-documents',            v_parent_id, 1, 'all'),
      ('Mentor Training',          'mentor-training',          v_parent_id, 2, 'all'),
      ('Mentor & YP Engagement',   'mentor-yp-engagement',    v_parent_id, 3, 'all'),
      ('YP Resources',             'yp-resources',             v_parent_id, 4, 'all'),
      ('Checklists',               'checklists',               v_parent_id, 5, 'all')
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  -- ── Fundraising & Partnerships (3 subcategories) ───────────────────────
  SELECT id INTO v_parent_id FROM public.resource_categories WHERE slug = 'fundraising-partnerships' AND deleted_at IS NULL;
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.resource_categories (name, slug, parent_id, sort_order, visibility)
    VALUES
      ('Policy & Public Affairs',  'policy-public-affairs',  v_parent_id, 0, 'all'),
      ('Fundraising',              'fundraising',            v_parent_id, 1, 'all'),
      ('SDS Directory',            'sds-directory',          v_parent_id, 2, 'all')
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  -- ── Templates & Forms: no subcategories (leaf category) ────────────────

END $$;
