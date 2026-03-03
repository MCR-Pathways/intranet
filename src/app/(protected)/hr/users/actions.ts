"use server";

import { requireHRAdmin, requireHROrSystemsAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateUserProfile(
  userId: string,
  data: {
    full_name?: string;
    job_title?: string | null;
    user_type?: string;
    status?: string;
    is_hr_admin?: boolean;
    is_ld_admin?: boolean;
    is_systems_admin?: boolean;
    is_line_manager?: boolean;
    fte?: number;
    contract_type?: string;
    department?: string | null;
    region?: string | null;
    work_pattern?: string;
    start_date?: string | null;
    probation_end_date?: string | null;
    contract_end_date?: string | null;
    is_external?: boolean;
    line_manager_id?: string | null;
    team_id?: string | null;
  }
) {
  // HR admin or systems admin can update profiles
  const { supabase, user, isHRAdmin, isSystemsAdmin } = await requireHROrSystemsAdmin();

  // Self-promotion prevention (belt 3 — server action layer)
  // DB trigger (belt 2) also enforces this, but we catch it early for better UX
  if (user.id === userId) {
    delete data.department;
    delete data.is_hr_admin;
    delete data.is_ld_admin;
    delete data.is_systems_admin;
  }

  // Systems-only admins cannot change admin flags or department
  if (isSystemsAdmin && !isHRAdmin) {
    delete data.is_hr_admin;
    delete data.is_ld_admin;
    delete data.is_systems_admin;
    delete data.department;
  }

  // Whitelist: only allow expected fields through to the database
  const ALLOWED_FIELDS = [
    "full_name",
    "job_title",
    "user_type",
    "status",
    "is_hr_admin",
    "is_ld_admin",
    "is_systems_admin",
    "is_line_manager",
    "fte",
    "contract_type",
    "department",
    "region",
    "work_pattern",
    "start_date",
    "probation_end_date",
    "contract_end_date",
    "is_external",
    "line_manager_id",
    "team_id",
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
  revalidatePath(`/hr/users/${userId}`);
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

  // Use an atomic RPC call to delete progress items and reset profile in one transaction
  const { error } = await supabase.rpc("reset_user_induction", {
    target_user_id: userId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/hr/users");
  return { success: true, error: null };
}

/**
 * Update employment-related fields on a target employee's profile.
 * HR admin only.
 */
export async function updateEmployeeEmployment(
  userId: string,
  data: {
    fte?: number;
    contract_type?: string;
    department?: string | null;
    region?: string | null;
    work_pattern?: string;
    start_date?: string | null;
    probation_end_date?: string | null;
    contract_end_date?: string | null;
    line_manager_id?: string | null;
    team_id?: string | null;
    is_external?: boolean;
  }
) {
  const { supabase } = await requireHRAdmin();

  const ALLOWED_FIELDS = [
    "fte",
    "contract_type",
    "department",
    "region",
    "work_pattern",
    "start_date",
    "probation_end_date",
    "contract_end_date",
    "line_manager_id",
    "team_id",
    "is_external",
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
  revalidatePath(`/hr/users/${userId}`);
  return { success: true, error: null };
}

/**
 * Update personal details on a target employee's employee_details record.
 * HR admin only — can edit ALL fields including DOB and NI number.
 */
export async function updateEmployeePersonalDetails(
  userId: string,
  data: {
    date_of_birth?: string | null;
    gender?: string | null;
    pronouns?: string | null;
    nationality?: string | null;
    address_line_1?: string | null;
    address_line_2?: string | null;
    city?: string | null;
    postcode?: string | null;
    country?: string;
    personal_email?: string | null;
    personal_phone?: string | null;
    ni_number?: string | null;
  }
) {
  const { supabase } = await requireHRAdmin();

  const ALLOWED_FIELDS = [
    "date_of_birth",
    "gender",
    "pronouns",
    "nationality",
    "address_line_1",
    "address_line_2",
    "city",
    "postcode",
    "country",
    "personal_email",
    "personal_phone",
    "ni_number",
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

  // Upsert: create or update employee_details row atomically
  const { error } = await supabase
    .from("employee_details")
    .upsert({ ...sanitized, profile_id: userId }, { onConflict: "profile_id" });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/hr/users/${userId}`);
  return { success: true, error: null };
}
