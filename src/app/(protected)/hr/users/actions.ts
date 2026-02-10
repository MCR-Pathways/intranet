"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireHRAdmin() {
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

export async function updateUserProfile(
  userId: string,
  data: {
    full_name?: string;
    job_title?: string | null;
    user_type?: string;
    status?: string;
    is_hr_admin?: boolean;
    is_line_manager?: boolean;
  }
) {
  const { supabase } = await requireHRAdmin();

  const { error } = await supabase
    .from("profiles")
    .update(data)
    .eq("id", userId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/hr/users");
  return { success: true, error: null };
}

export async function completeUserInduction(userId: string) {
  const { supabase } = await requireHRAdmin();

  const { error } = await supabase
    .from("profiles")
    .update({
      induction_completed_at: new Date().toISOString(),
      status: "active",
    })
    .eq("id", userId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/hr/users");
  return { success: true, error: null };
}

export async function resetUserInduction(userId: string) {
  const { supabase } = await requireHRAdmin();

  const { error } = await supabase
    .from("profiles")
    .update({
      induction_completed_at: null,
      status: "pending_induction",
    })
    .eq("id", userId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/hr/users");
  return { success: true, error: null };
}
