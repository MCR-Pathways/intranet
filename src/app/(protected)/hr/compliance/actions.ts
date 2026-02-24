"use server";

import { requireHRAdmin, getCurrentUser } from "@/lib/auth";
import { validateHRDocument } from "@/lib/hr";
import type { ComplianceStatus } from "@/lib/hr";
import { revalidatePath } from "next/cache";

const HR_DOCUMENTS_BUCKET = "hr-documents";

// =============================================
// STATUS CALCULATION
// =============================================

/**
 * Calculate compliance document status from expiry date.
 * - No expiry → "valid"
 * - Past today → "expired"
 * - Within 90 days → "expiring_soon"
 * - Otherwise → "valid"
 */
export async function calculateDocumentStatus(
  expiryDate: string | null
): Promise<ComplianceStatus> {
  if (!expiryDate) return "valid";

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate + "T00:00:00");

  if (expiry < now) return "expired";

  const daysUntilExpiry = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntilExpiry <= 90) return "expiring_soon";

  return "valid";
}

// =============================================
// UPLOAD
// =============================================

/**
 * Upload a compliance document for an employee.
 * HR admin only. File is stored in private `hr-documents` bucket.
 */
export async function uploadComplianceDocument(formData: FormData) {
  const { supabase, user } = await requireHRAdmin();

  const profileId = formData.get("profile_id") as string | null;
  const documentTypeId = formData.get("document_type_id") as string | null;
  const referenceNumber = formData.get("reference_number") as string | null;
  const issueDate = formData.get("issue_date") as string | null;
  const expiryDate = formData.get("expiry_date") as string | null;
  const notes = formData.get("notes") as string | null;
  const file = formData.get("file") as File | null;

  if (!profileId || !documentTypeId) {
    return { success: false, error: "Employee and document type are required" };
  }

  // Calculate status from expiry date
  const status = await calculateDocumentStatus(expiryDate);

  let filePath: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;
  let mimeType: string | null = null;

  // Upload file if provided
  if (file && file.size > 0) {
    const validationError = validateHRDocument({ size: file.size, type: file.type });
    if (validationError) {
      return { success: false, error: validationError };
    }

    const fileExt = file.name.split(".").pop();
    const uniqueName = `${crypto.randomUUID()}.${fileExt}`;
    filePath = `${profileId}/${uniqueName}`;
    fileName = file.name;
    fileSize = file.size;
    mimeType = file.type;

    const { error: uploadError } = await supabase.storage
      .from(HR_DOCUMENTS_BUCKET)
      .upload(filePath, file);

    if (uploadError) {
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }
  }

  // Insert database record
  const { error: insertError } = await supabase
    .from("compliance_documents")
    .insert({
      profile_id: profileId,
      document_type_id: documentTypeId,
      reference_number: referenceNumber || null,
      issue_date: issueDate || null,
      expiry_date: expiryDate || null,
      status,
      file_path: filePath,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      notes: notes || null,
      uploaded_by: user.id,
    });

  if (insertError) {
    // Clean up orphaned file if DB insert failed
    if (filePath) {
      await supabase.storage.from(HR_DOCUMENTS_BUCKET).remove([filePath]);
    }
    return { success: false, error: insertError.message };
  }

  revalidatePath("/hr/compliance");
  revalidatePath(`/hr/users/${profileId}`);
  revalidatePath("/hr/profile");
  return { success: true, error: null };
}

// =============================================
// UPDATE
// =============================================

/**
 * Update compliance document metadata.
 * HR admin only.
 */
export async function updateComplianceDocument(
  docId: string,
  data: {
    reference_number?: string | null;
    issue_date?: string | null;
    expiry_date?: string | null;
    status?: string;
    notes?: string | null;
  }
) {
  const { supabase } = await requireHRAdmin();

  const ALLOWED_FIELDS = [
    "reference_number",
    "issue_date",
    "expiry_date",
    "status",
    "notes",
  ] as const;

  const sanitized: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in data && data[field as keyof typeof data] !== undefined) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  // Auto-recalculate status if expiry_date was changed
  if ("expiry_date" in data) {
    sanitized.status = await calculateDocumentStatus(
      data.expiry_date as string | null
    );
  }

  if (Object.keys(sanitized).length === 0) {
    return { success: false, error: "No valid fields to update" };
  }

  // Fetch profile_id for revalidation
  const { data: doc } = await supabase
    .from("compliance_documents")
    .select("profile_id")
    .eq("id", docId)
    .single();

  const { error } = await supabase
    .from("compliance_documents")
    .update(sanitized)
    .eq("id", docId)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/hr/compliance");
  if (doc?.profile_id) {
    revalidatePath(`/hr/users/${doc.profile_id}`);
  }
  revalidatePath("/hr/profile");
  return { success: true, error: null };
}

// =============================================
// VERIFY
// =============================================

/**
 * Mark a compliance document as verified by the current HR admin.
 */
export async function verifyComplianceDocument(docId: string) {
  const { supabase, user } = await requireHRAdmin();

  // Fetch profile_id for revalidation
  const { data: doc } = await supabase
    .from("compliance_documents")
    .select("profile_id")
    .eq("id", docId)
    .single();

  const { error } = await supabase
    .from("compliance_documents")
    .update({
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", docId)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/hr/compliance");
  if (doc?.profile_id) {
    revalidatePath(`/hr/users/${doc.profile_id}`);
  }
  return { success: true, error: null };
}

// =============================================
// DELETE
// =============================================

/**
 * Delete a compliance document and its associated file.
 * HR admin only.
 */
export async function deleteComplianceDocument(docId: string) {
  const { supabase } = await requireHRAdmin();

  // Fetch file path and profile_id before deletion
  const { data: doc } = await supabase
    .from("compliance_documents")
    .select("file_path, profile_id")
    .eq("id", docId)
    .single();

  if (!doc) {
    return { success: false, error: "Document not found" };
  }

  // Delete database record first to avoid broken references
  const { error } = await supabase
    .from("compliance_documents")
    .delete()
    .eq("id", docId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Delete file from storage after DB record is removed
  // An orphaned file is preferable to a broken DB reference
  if (doc.file_path) {
    await supabase.storage.from(HR_DOCUMENTS_BUCKET).remove([doc.file_path]);
  }

  revalidatePath("/hr/compliance");
  revalidatePath(`/hr/users/${doc.profile_id}`);
  revalidatePath("/hr/profile");
  return { success: true, error: null };
}

// =============================================
// SIGNED URL FOR DOWNLOAD
// =============================================

/**
 * Get a signed download URL for a compliance document file.
 * Accessible by HR admins or the document owner.
 */
export async function getComplianceDocumentUrl(filePath: string) {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile) {
    return { success: false, error: "Not authenticated", url: null };
  }

  // The file path format is `{profileId}/{uuid}.{ext}`
  // Check if the user owns the document or is an HR admin
  const pathParts = filePath.split("/");
  const fileOwner = pathParts[0];
  const isOwner = fileOwner === user.id;

  if (!isOwner && !profile.is_hr_admin) {
    return { success: false, error: "Access denied", url: null };
  }

  const { data, error } = await supabase.storage
    .from(HR_DOCUMENTS_BUCKET)
    .createSignedUrl(filePath, 3600); // 60 minutes

  if (error) {
    return { success: false, error: error.message, url: null };
  }

  return { success: true, error: null, url: data.signedUrl };
}
