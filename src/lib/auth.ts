import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Re-export client-safe helpers so server components can import everything from @/lib/auth
export { isHRAdminEffective, isLDAdminEffective, isSystemsAdminEffective } from "@/lib/auth-helpers";

/** Fields selected for profile — excludes sensitive data like google_refresh_token */
const PROFILE_SELECT =
  "id, full_name, preferred_name, email, avatar_url, user_type, status, is_hr_admin, is_ld_admin, is_line_manager, is_systems_admin, job_title, induction_completed_at, last_sign_in_date, fte, contract_type, department, region, is_external, work_pattern, start_date";

/**
 * Extended profile select for HR admin views — includes employment details
 * but still excludes google_refresh_token and other auth-sensitive fields.
 */
export const HR_EMPLOYEE_SELECT =
  "id, full_name, preferred_name, email, avatar_url, phone, user_type, status, is_hr_admin, is_ld_admin, is_line_manager, is_systems_admin, job_title, start_date, fte, contract_type, department, region, is_external, probation_end_date, contract_end_date, work_pattern, line_manager_id, team_id, induction_completed_at, last_sign_in_date, created_at";

// =============================================
// SERVER-SIDE AUTH FUNCTIONS
// =============================================

/**
 * Get the current authenticated user and their profile.
 * Returns null user/profile if not authenticated.
 *
 * Wrapped with React `cache()` so multiple calls within the same
 * server-render request (e.g. layout + page) share a single promise,
 * preventing duplicate Supabase auth sessions that cause SSR hangs.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .single();

  return { supabase, user, profile };
});

/**
 * Require the current user to be an authenticated HR admin.
 * Uses the DB function is_hr_admin_effective() as single source of truth.
 * Throws if not authenticated or not an effective HR admin.
 * Returns the supabase client and user for further queries.
 */
export async function requireHRAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: isAdmin } = await supabase.rpc("is_hr_admin_effective", {
    p_user_id: user.id,
  });

  if (!isAdmin) {
    throw new Error("Unauthorised: HR admin access required");
  }

  return { supabase, user };
}

/**
 * Require the current user to be an authenticated L&D admin.
 * Uses the DB function is_ld_admin_effective() as single source of truth.
 * Throws if not authenticated or not an effective L&D admin.
 * Returns the supabase client and user for further queries.
 */
export async function requireLDAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: isAdmin } = await supabase.rpc("is_ld_admin_effective", {
    p_user_id: user.id,
  });

  if (!isAdmin) {
    throw new Error("Unauthorised: L&D admin access required");
  }

  return { supabase, user };
}

/**
 * Require the current user to be an authenticated systems admin.
 * Uses the DB function is_systems_admin_effective() as single source of truth.
 * Throws if not authenticated or not an effective systems admin.
 * Returns the supabase client and user for further queries.
 */
export async function requireSystemsAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: isAdmin } = await supabase.rpc("is_systems_admin_effective", {
    p_user_id: user.id,
  });

  if (!isAdmin) {
    throw new Error("Unauthorised: Systems admin access required");
  }

  return { supabase, user };
}

/**
 * Require the current user to be an HR admin OR systems admin.
 * Used for routes accessible to both roles (e.g. User Management, Onboarding).
 */
export async function requireHROrSystemsAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const [{ data: isHR }, { data: isSystems }] = await Promise.all([
    supabase.rpc("is_hr_admin_effective", { p_user_id: user.id }),
    supabase.rpc("is_systems_admin_effective", { p_user_id: user.id }),
  ]);

  if (!isHR && !isSystems) {
    throw new Error("Unauthorised: HR admin or systems admin access required");
  }

  return { supabase, user, isHRAdmin: !!isHR, isSystemsAdmin: !!isSystems };
}
