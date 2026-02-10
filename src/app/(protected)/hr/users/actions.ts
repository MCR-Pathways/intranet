"use server";

import { requireHRAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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

  // Whitelist: only allow expected fields through to the database
  const ALLOWED_FIELDS = [
    "full_name",
    "job_title",
    "user_type",
    "status",
    "is_hr_admin",
    "is_line_manager",
  ] as const;

  const sanitized: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in data) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  if (Object.keys(sanitized).length === 0) {
    return { success: false, error: "No valid fields to update" };
  }

  const { error } = await supabase
    .from("profiles")
    .update(sanitized)
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
