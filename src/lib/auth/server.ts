import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/types/database.types";
import { fetchProfile } from "@/lib/auth/profile";

export async function getAuthenticatedUser(
  supabase: SupabaseClient<Database>
) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Error fetching auth user:", error);
  }

  return user;
}

export async function getUserWithProfile(
  supabase: SupabaseClient<Database>
): Promise<{
  user: Awaited<ReturnType<typeof getAuthenticatedUser>>;
  profile: Profile | null;
}> {
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return { user: null, profile: null };
  }

  const profile = await fetchProfile(supabase, user.id);
  return { user, profile };
}

export async function requireUserWithProfile(
  supabase: SupabaseClient<Database>
) {
  const { user, profile } = await getUserWithProfile(supabase);
  if (!user) {
    redirect("/login");
  }

  return { user, profile };
}
