-- MCR Pathways Intranet - Enum Types
-- This migration creates all the enum types used across the database

-- User type enum
CREATE TYPE user_type AS ENUM (
  'staff',
  'pathways_coordinator',
  'new_user'
);

-- User status enum
CREATE TYPE user_status AS ENUM (
  'active',
  'inactive',
  'pending_induction'
);

-- Leave type enum
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

-- Leave status enum
CREATE TYPE leave_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

-- Work location enum
CREATE TYPE work_location AS ENUM (
  'home',
  'glasgow_office',
  'stevenage_office',
  'other'
);

-- Course category enum
CREATE TYPE course_category AS ENUM (
  'compliance',
  'upskilling',
  'soft_skills'
);
