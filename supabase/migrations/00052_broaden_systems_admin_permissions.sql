-- ============================================================================
-- Migration: 00052_broaden_systems_admin_permissions.sql
-- Description: Allow systems admins to grant/revoke L&D Admin, Systems Admin,
--   and Line Manager permissions. Previously only HR admins could change any
--   admin flags. HR Admin and department changes remain HR-admin-only.
--
--   Changes to protect_admin_fields() trigger:
--   - is_ld_admin, is_systems_admin: HR admin OR systems admin can change
--   - is_hr_admin, department: HR admin only (unchanged)
--   - Self-promotion prevention: unchanged (block all self-changes)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_admin_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_is_hr_admin BOOLEAN;
  v_caller_is_systems_admin BOOLEAN;
BEGIN
  -- Skip if called by service role (no auth.uid())
  IF v_caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block self-changes to department and admin flags
  IF v_caller_id = NEW.id THEN
    IF NEW.department IS DISTINCT FROM OLD.department THEN
      RAISE EXCEPTION 'Cannot change your own department';
    END IF;
    IF NEW.is_hr_admin IS DISTINCT FROM OLD.is_hr_admin THEN
      RAISE EXCEPTION 'Cannot change your own HR admin status';
    END IF;
    IF NEW.is_ld_admin IS DISTINCT FROM OLD.is_ld_admin THEN
      RAISE EXCEPTION 'Cannot change your own L&D admin status';
    END IF;
    IF NEW.is_systems_admin IS DISTINCT FROM OLD.is_systems_admin THEN
      RAISE EXCEPTION 'Cannot change your own systems admin status';
    END IF;
  END IF;

  -- Only effective HR admins can change department or grant HR admin
  IF NEW.department IS DISTINCT FROM OLD.department
     OR NEW.is_hr_admin IS DISTINCT FROM OLD.is_hr_admin THEN
    v_caller_is_hr_admin := public.is_hr_admin_effective(v_caller_id);
    IF NOT v_caller_is_hr_admin THEN
      RAISE EXCEPTION 'Only HR admins can change department or HR admin status';
    END IF;
  END IF;

  -- HR admins or systems admins can change systems admin status
  IF NEW.is_systems_admin IS DISTINCT FROM OLD.is_systems_admin THEN
    v_caller_is_hr_admin := COALESCE(v_caller_is_hr_admin, public.is_hr_admin_effective(v_caller_id));
    v_caller_is_systems_admin := public.is_systems_admin_effective(v_caller_id);
    IF NOT v_caller_is_hr_admin AND NOT v_caller_is_systems_admin THEN
      RAISE EXCEPTION 'Only HR admins or systems admins can change systems admin status';
    END IF;
  END IF;

  -- HR admins or systems admins can change L&D admin status
  IF NEW.is_ld_admin IS DISTINCT FROM OLD.is_ld_admin THEN
    v_caller_is_hr_admin := COALESCE(v_caller_is_hr_admin, public.is_hr_admin_effective(v_caller_id));
    v_caller_is_systems_admin := COALESCE(v_caller_is_systems_admin, public.is_systems_admin_effective(v_caller_id));
    IF NOT v_caller_is_hr_admin AND NOT v_caller_is_systems_admin THEN
      RAISE EXCEPTION 'Only HR admins or systems admins can change L&D admin status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
