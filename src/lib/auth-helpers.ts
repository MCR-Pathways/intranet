/**
 * Client-safe auth helpers.
 *
 * These derive effective admin status from profile fields.
 * They mirror the DB functions (is_hr_admin_effective, etc.)
 * so client components don't need RPC calls.
 *
 * This file must NOT import any server-only modules
 * (supabase/server, next/headers, etc.) so it can be used
 * in "use client" components like the sidebar.
 */

import type { Profile } from "@/types/database.types";

/** Check if a profile has effective HR admin access */
export function isHRAdminEffective(profile: Pick<Profile, "department" | "is_hr_admin" | "status"> | null): boolean {
  if (!profile || profile.status !== "active") return false;
  return profile.department === "hr" || profile.is_hr_admin === true;
}

/** Check if a profile has effective L&D admin access */
export function isLDAdminEffective(profile: Pick<Profile, "department" | "is_ld_admin" | "status"> | null): boolean {
  if (!profile || profile.status !== "active") return false;
  return profile.department === "learning_development" || profile.is_ld_admin === true;
}

/** Check if a profile has effective systems admin access */
export function isSystemsAdminEffective(profile: Pick<Profile, "department" | "is_systems_admin" | "status"> | null): boolean {
  if (!profile || profile.status !== "active") return false;
  return profile.department === "systems" || profile.is_systems_admin === true;
}
