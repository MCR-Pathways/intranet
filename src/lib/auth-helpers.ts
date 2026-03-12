/**
 * Client-safe auth helpers.
 *
 * These derive admin status from explicit profile flags.
 * They mirror the DB functions (is_hr_admin_effective, etc.)
 * so client components don't need RPC calls.
 *
 * Admin access is explicitly granted — department membership
 * is purely organisational and does NOT auto-grant admin.
 *
 * This file must NOT import any server-only modules
 * (supabase/server, next/headers, etc.) so it can be used
 * in "use client" components like the sidebar.
 */

import type { Profile } from "@/types/database.types";

/** Check if a profile has explicit HR admin access */
export function isHRAdminEffective(profile: Pick<Profile, "is_hr_admin" | "status"> | null): boolean {
  if (!profile || profile.status !== "active") return false;
  return profile.is_hr_admin === true;
}

/** Check if a profile has explicit L&D admin access */
export function isLDAdminEffective(profile: Pick<Profile, "is_ld_admin" | "status"> | null): boolean {
  if (!profile || profile.status !== "active") return false;
  return profile.is_ld_admin === true;
}

/** Check if a profile has explicit systems admin access */
export function isSystemsAdminEffective(profile: Pick<Profile, "is_systems_admin" | "status"> | null): boolean {
  if (!profile || profile.status !== "active") return false;
  return profile.is_systems_admin === true;
}

/** Check if a profile has explicit content editor access */
export function isContentEditorEffective(profile: Pick<Profile, "is_content_editor" | "status"> | null): boolean {
  if (!profile || profile.status !== "active") return false;
  return profile.is_content_editor === true;
}
