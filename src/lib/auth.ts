import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Fields selected for profile — excludes sensitive data like google_refresh_token */
const PROFILE_SELECT =
  "id, full_name, preferred_name, email, avatar_url, user_type, status, is_hr_admin, is_line_manager, job_title, induction_completed_at, last_sign_in_date";

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
 * Throws if not authenticated or not an HR admin.
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_hr_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_hr_admin) {
    throw new Error("Unauthorized: HR admin access required");
  }

  return { supabase, user };
}
