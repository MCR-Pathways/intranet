"use server";

import { requireHRAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

// =============================================
// CREATE ASSET
// =============================================

export async function createAsset(data: {
  asset_type_id: string;
  asset_tag: string;
  make?: string;
  model?: string;
  serial_number?: string;
  purchase_date?: string;
  purchase_cost?: number;
  warranty_expiry_date?: string;
  notes?: string;
}) {
  const { supabase } = await requireHRAdmin();

  const ALLOWED_FIELDS = [
    "asset_type_id", "asset_tag", "make", "model", "serial_number",
    "purchase_date", "purchase_cost", "warranty_expiry_date", "notes",
  ] as const;

  const sanitized: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in data && data[field as keyof typeof data] !== undefined) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  if (!sanitized.asset_type_id || !sanitized.asset_tag) {
    return { success: false, error: "Asset type and tag are required" };
  }

  sanitized.status = "available";

  const { error } = await supabase.from("assets").insert(sanitized);

  if (error) {
    if (error.message.includes("duplicate") || error.message.includes("unique")) {
      return { success: false, error: "An asset with this tag already exists" };
    }
    logger.error("Failed to create asset", { error: error.message });
    return { success: false, error: "Failed to create asset. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/assets");
  return { success: true, error: null };
}

// =============================================
// UPDATE ASSET
// =============================================

export async function updateAsset(
  assetId: string,
  data: {
    asset_type_id?: string;
    asset_tag?: string;
    make?: string | null;
    model?: string | null;
    serial_number?: string | null;
    purchase_date?: string | null;
    purchase_cost?: number | null;
    warranty_expiry_date?: string | null;
    status?: string;
    notes?: string | null;
  }
) {
  const { supabase } = await requireHRAdmin();

  const ALLOWED_FIELDS = [
    "asset_type_id", "asset_tag", "make", "model", "serial_number",
    "purchase_date", "purchase_cost", "warranty_expiry_date", "status", "notes",
  ] as const;

  const sanitized: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in data && data[field as keyof typeof data] !== undefined) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  if (Object.keys(sanitized).length === 0) {
    return { success: false, error: "No valid fields to update" };
  }

  const { error } = await supabase
    .from("assets")
    .update(sanitized)
    .eq("id", assetId)
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to update asset", { error: error.message });
    return { success: false, error: "Failed to update asset. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/assets");
  return { success: true, error: null };
}

// =============================================
// ASSIGN ASSET
// =============================================

export async function assignAsset(
  assetId: string,
  profileId: string,
  data: {
    assigned_date?: string;
    condition_on_assignment?: string;
    notes?: string;
  }
) {
  const { supabase, user } = await requireHRAdmin();

  // Verify asset is available
  const { data: asset } = await supabase
    .from("assets")
    .select("id, status")
    .eq("id", assetId)
    .single();

  if (!asset) {
    return { success: false, error: "Asset not found" };
  }

  if (asset.status !== "available" && asset.status !== "in_repair") {
    return { success: false, error: `Cannot assign asset with status '${asset.status}'` };
  }

  // Create assignment record
  const { data: newAssignment, error: assignError } = await supabase
    .from("asset_assignments")
    .insert({
      asset_id: assetId,
      profile_id: profileId,
      assigned_date: data.assigned_date || new Date().toISOString().slice(0, 10),
      assigned_by: user.id,
      condition_on_assignment: data.condition_on_assignment || null,
      notes: data.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (assignError) {
    logger.error("Failed to assign asset", { error: assignError.message });
    return { success: false, error: "Failed to assign asset. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  // Update asset status
  const { error: updateError } = await supabase
    .from("assets")
    .update({ status: "assigned" })
    .eq("id", assetId)
    .select("id")
    .single();

  if (updateError) {
    // Rollback: remove the assignment record to keep state consistent
    await supabase.from("asset_assignments").delete().eq("id", newAssignment.id);
    logger.error("Failed to update asset status after assignment", { error: updateError.message });
    return { success: false, error: "Failed to assign asset. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/assets");
  revalidatePath(`/hr/users/${profileId}`);
  return { success: true, error: null };
}

// =============================================
// RETURN ASSET
// =============================================

export async function returnAsset(
  assignmentId: string,
  data: {
    returned_date?: string;
    condition_on_return?: string;
    notes?: string;
  }
) {
  const { supabase } = await requireHRAdmin();

  // Fetch assignment to get asset_id and profile_id
  const { data: assignment } = await supabase
    .from("asset_assignments")
    .select("id, asset_id, profile_id")
    .eq("id", assignmentId)
    .single();

  if (!assignment) {
    return { success: false, error: "Assignment not found" };
  }

  // Update assignment with return info
  const { error: returnError } = await supabase
    .from("asset_assignments")
    .update({
      returned_date: data.returned_date || new Date().toISOString().slice(0, 10),
      condition_on_return: data.condition_on_return || null,
      notes: data.notes?.trim() || null,
    })
    .eq("id", assignmentId)
    .select("id")
    .single();

  if (returnError) {
    logger.error("Failed to return asset", { error: returnError.message });
    return { success: false, error: "Failed to return asset. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  // Update asset status to available
  const { error: updateError } = await supabase
    .from("assets")
    .update({ status: "available" })
    .eq("id", assignment.asset_id)
    .select("id")
    .single();

  if (updateError) {
    // Rollback: revert assignment to un-returned state
    await supabase
      .from("asset_assignments")
      .update({ returned_date: null, condition_on_return: null })
      .eq("id", assignmentId);
    logger.error("Failed to update asset status after return", { error: updateError.message });
    return { success: false, error: "Failed to return asset. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/assets");
  revalidatePath(`/hr/users/${assignment.profile_id}`);
  return { success: true, error: null };
}

// =============================================
// RETIRE ASSET
// =============================================

export async function retireAsset(assetId: string) {
  const { supabase } = await requireHRAdmin();

  // Verify no current assignment
  const { data: activeAssignment } = await supabase
    .from("asset_assignments")
    .select("id")
    .eq("asset_id", assetId)
    .is("returned_date", null)
    .limit(1);

  if (activeAssignment && activeAssignment.length > 0) {
    return { success: false, error: "Cannot retire an asset that is currently assigned. Return it first." };
  }

  const { error } = await supabase
    .from("assets")
    .update({ status: "retired" })
    .eq("id", assetId)
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to retire asset", { error: error.message });
    return { success: false, error: "Failed to retire asset. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/assets");
  return { success: true, error: null };
}
