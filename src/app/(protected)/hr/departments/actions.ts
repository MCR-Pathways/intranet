"use server";

import { requireHRAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// =============================================
// CREATE DEPARTMENT
// =============================================

export async function createDepartment(data: {
  name: string;
  slug: string;
  colour: string;
  sort_order: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireHRAdmin();

    const { error } = await supabase.from("departments").insert({
      name: data.name.trim(),
      slug: data.slug.trim().toLowerCase(),
      colour: data.colour,
      sort_order: data.sort_order,
    });

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "A department with this slug already exists" };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/hr/departments");
    revalidatePath("/hr/users");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create department";
    return { success: false, error: message };
  }
}

// =============================================
// UPDATE DEPARTMENT
// =============================================

export async function updateDepartment(
  id: string,
  data: {
    name?: string;
    slug?: string;
    colour?: string;
    sort_order?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireHRAdmin();

    // Whitelist allowed fields
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.slug !== undefined) updates.slug = data.slug.trim().toLowerCase();
    if (data.colour !== undefined) updates.colour = data.colour;
    if (data.sort_order !== undefined) updates.sort_order = data.sort_order;

    if (Object.keys(updates).length === 0) {
      return { success: false, error: "No fields to update" };
    }

    const { error } = await supabase
      .from("departments")
      .update(updates)
      .eq("id", id);

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "A department with this slug already exists" };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/hr/departments");
    revalidatePath("/hr/users");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update department";
    return { success: false, error: message };
  }
}

// =============================================
// TOGGLE DEPARTMENT ACTIVE STATUS
// =============================================

export async function toggleDepartmentActive(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireHRAdmin();

    // Fetch current department
    const { data: dept, error: fetchError } = await supabase
      .from("departments")
      .select("id, slug, is_active")
      .eq("id", id)
      .single();

    if (fetchError || !dept) {
      return { success: false, error: "Department not found" };
    }

    // If deactivating, check for active employees
    if (dept.is_active) {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("department", dept.slug)
        .eq("status", "active");

      if (count && count > 0) {
        return {
          success: false,
          error: `Cannot deactivate: ${count} active employee${count === 1 ? "" : "s"} in this department. Reassign them first.`,
        };
      }
    }

    const { error: updateError } = await supabase
      .from("departments")
      .update({ is_active: !dept.is_active })
      .eq("id", id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath("/hr/departments");
    revalidatePath("/hr/users");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update department status";
    return { success: false, error: message };
  }
}
