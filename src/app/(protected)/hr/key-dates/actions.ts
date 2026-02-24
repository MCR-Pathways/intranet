"use server";

import { requireHRAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// =============================================
// CREATE KEY DATE
// =============================================

export async function createKeyDate(data: {
  profile_id: string;
  date_type: string;
  due_date: string;
  title: string;
  description?: string;
  alert_days_before?: number[];
}) {
  const { supabase } = await requireHRAdmin();

  if (!data.profile_id || !data.date_type || !data.due_date || !data.title) {
    return { success: false, error: "Employee, type, date, and title are required" };
  }

  const { error } = await supabase.from("key_dates").insert({
    profile_id: data.profile_id,
    date_type: data.date_type,
    due_date: data.due_date,
    title: data.title.trim(),
    description: data.description?.trim() || null,
    alert_days_before: data.alert_days_before ?? [30, 7],
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/hr/users/${data.profile_id}`);
  revalidatePath("/hr/key-dates");
  return { success: true, error: null };
}

// =============================================
// UPDATE KEY DATE
// =============================================

export async function updateKeyDate(
  keyDateId: string,
  data: {
    due_date?: string;
    title?: string;
    description?: string | null;
    alert_days_before?: number[];
  }
) {
  const { supabase } = await requireHRAdmin();

  const ALLOWED_FIELDS = ["due_date", "title", "description", "alert_days_before"] as const;

  const sanitized: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in data && data[field as keyof typeof data] !== undefined) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  if (Object.keys(sanitized).length === 0) {
    return { success: false, error: "No valid fields to update" };
  }

  // Fetch profile_id for revalidation
  const { data: keyDate } = await supabase
    .from("key_dates")
    .select("profile_id")
    .eq("id", keyDateId)
    .single();

  const { error } = await supabase
    .from("key_dates")
    .update(sanitized)
    .eq("id", keyDateId)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  if (keyDate?.profile_id) {
    revalidatePath(`/hr/users/${keyDate.profile_id}`);
  }
  revalidatePath("/hr/key-dates");
  return { success: true, error: null };
}

// =============================================
// COMPLETE KEY DATE
// =============================================

export async function completeKeyDate(keyDateId: string) {
  const { supabase, user } = await requireHRAdmin();

  const { data: keyDate } = await supabase
    .from("key_dates")
    .select("profile_id")
    .eq("id", keyDateId)
    .single();

  const { error } = await supabase
    .from("key_dates")
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      completed_by: user.id,
    })
    .eq("id", keyDateId)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  if (keyDate?.profile_id) {
    revalidatePath(`/hr/users/${keyDate.profile_id}`);
  }
  revalidatePath("/hr/key-dates");
  return { success: true, error: null };
}

// =============================================
// DELETE KEY DATE
// =============================================

export async function deleteKeyDate(keyDateId: string) {
  const { supabase } = await requireHRAdmin();

  const { data: keyDate } = await supabase
    .from("key_dates")
    .select("profile_id")
    .eq("id", keyDateId)
    .single();

  if (!keyDate) {
    return { success: false, error: "Key date not found" };
  }

  const { error } = await supabase
    .from("key_dates")
    .delete()
    .eq("id", keyDateId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/hr/users/${keyDate.profile_id}`);
  revalidatePath("/hr/key-dates");
  return { success: true, error: null };
}
