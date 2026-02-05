-- MCR Pathways Intranet - Enum Types
-- This migration creates all the enum types used across the database
-- Using DO blocks to make migrations idempotent (safe to re-run)

-- User type is now TEXT (not an enum) for simplicity
-- Valid values: 'staff', 'pathways_coordinator', 'new_user'

-- User status is now TEXT (not an enum) for simplicity
-- Valid values: 'active', 'inactive', 'pending_induction'

-- Leave type enum
DO $$ BEGIN
  CREATE TYPE leave_type AS ENUM (
    'annual',
    'sick',
    'compassionate',
    'parental',
    'toil',
    'unpaid',
    'study',
    'jury_duty'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Leave status enum
DO $$ BEGIN
  CREATE TYPE leave_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Work location enum
DO $$ BEGIN
  CREATE TYPE work_location AS ENUM (
    'home',
    'glasgow_office',
    'stevenage_office',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Course category enum
DO $$ BEGIN
  CREATE TYPE course_category AS ENUM (
    'compliance',
    'upskilling',
    'soft_skills'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
