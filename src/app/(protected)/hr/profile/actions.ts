"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

/**
 * Update the current user's own personal details (employee_details table).
 * Employees can edit a subset of fields — NOT date_of_birth or ni_number.
 */
export async function updatePersonalDetails(data: {
  pronouns?: string | null;
  personal_email?: string | null;
  personal_phone?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string;
  nationality?: string | null;
  gender?: string | null;
}) {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Whitelist: employees cannot edit date_of_birth or ni_number
  const ALLOWED_FIELDS = [
    "pronouns",
    "personal_email",
    "personal_phone",
    "address_line_1",
    "address_line_2",
    "city",
    "postcode",
    "country",
    "nationality",
    "gender",
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
    .upsert({ ...sanitized, profile_id: user.id }, { onConflict: "profile_id" });

  if (error) {
    logger.error("Failed to update personal details", { error: error.message });
    return { success: false, error: "Failed to update personal details. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/profile");
  return { success: true, error: null };
}

/**
 * Create or update an emergency contact for the current user.
 * If `id` is provided, update; otherwise insert (max 2 contacts).
 */
export async function upsertEmergencyContact(data: {
  id?: string;
  full_name: string;
  relationship: string;
  phone_primary: string;
  phone_secondary?: string | null;
  email?: string | null;
  sort_order: number;
}) {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const ALLOWED_FIELDS = [
    "full_name",
    "relationship",
    "phone_primary",
    "phone_secondary",
    "email",
    "sort_order",
  ] as const;

  const sanitized: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in data) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  if (data.id) {
    // Update existing contact — double eq ensures ownership
    const { error } = await supabase
      .from("emergency_contacts")
      .update(sanitized)
      .eq("id", data.id)
      .eq("profile_id", user.id)
      .select("id")
      .single();

    if (error) {
      logger.error("Failed to update emergency contact", { error: error.message });
      return { success: false, error: "Failed to update emergency contact. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
    }
  } else {
    // Check count before insert — max 2 emergency contacts
    const { count } = await supabase
      .from("emergency_contacts")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id);

    if ((count ?? 0) >= 2) {
      return { success: false, error: "Maximum of 2 emergency contacts allowed" };
    }

    const { error } = await supabase
      .from("emergency_contacts")
      .insert({ ...sanitized, profile_id: user.id });

    if (error) {
      logger.error("Failed to add emergency contact", { error: error.message });
      return { success: false, error: "Failed to add emergency contact. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
    }
  }

  revalidatePath("/hr/profile");
  return { success: true, error: null };
}

/**
 * Delete an emergency contact belonging to the current user.
 */
export async function deleteEmergencyContact(contactId: string) {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Ownership check via double eq
  const { error } = await supabase
    .from("emergency_contacts")
    .delete()
    .eq("id", contactId)
    .eq("profile_id", user.id);

  if (error) {
    logger.error("Failed to delete emergency contact", { error: error.message });
    return { success: false, error: "Failed to delete emergency contact. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/profile");
  return { success: true, error: null };
}
