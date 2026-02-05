-- MCR Pathways Intranet - Enum Types
-- This migration creates all the enum types used across the database
-- Using DO blocks to make migrations idempotent (safe to re-run)

-- User type enum
DO $$ BEGIN
  CREATE TYPE user_type AS ENUM (
    'staff',
    'pathways_coordinator',
    'new_user'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- User status enum
DO $$ BEGIN
  CREATE TYPE user_status AS ENUM (
    'active',
    'inactive',
    'pending_induction'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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
