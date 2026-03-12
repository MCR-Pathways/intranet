"use server";

import { getCurrentUser, requireHRAdmin } from "@/lib/auth";
import {
  ONBOARDING_CHECKLIST_SELECT,
  ONBOARDING_CHECKLIST_ITEM_SELECT,
  ONBOARDING_TEMPLATE_SELECT,
  ONBOARDING_TEMPLATE_ITEM_SELECT,
  formatHRDate,
} from "@/lib/hr";
import type {
  OnboardingSection,
  OnboardingAssigneeRole,
  OnboardingTemplate,
  OnboardingTemplateItem,
  OnboardingChecklist,
  OnboardingChecklistWithProgress,
  OnboardingChecklistItem,
} from "@/types/hr";
import { createNotification } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

// =============================================
// VALID VALUES
// =============================================

const VALID_SECTIONS: OnboardingSection[] = [
  "before_start", "day_one", "first_week", "first_month", "general",
];

const VALID_ASSIGNEE_ROLES: OnboardingAssigneeRole[] = [
  "hr_admin", "line_manager", "employee", "other",
];

// =============================================
// REVALIDATION HELPER
// =============================================

function revalidateOnboardingPaths(profileId?: string) {
  revalidatePath("/hr/onboarding");
  revalidatePath("/hr");
  if (profileId) {
    revalidatePath(`/hr/users/${profileId}`);
  }
}

// =============================================
// AUTHORITY CHECK (HR admin OR line manager)
// =============================================

/**
 * Verify the current user can view/manage an employee's onboarding checklist.
 * Must be an HR admin, the employee themselves, or the employee's line manager.
 * Matches RLS policy: HR admin OR employee OR line manager.
 */
async function verifyOnboardingAuthority(
  supabase: Awaited<ReturnType<typeof getCurrentUser>>["supabase"],
  currentUserId: string,
  employeeId: string,
): Promise<{ authorised: boolean; isHRAdmin: boolean; error?: string }> {
  // Employee viewing their own onboarding
  if (currentUserId === employeeId) {
    return { authorised: true, isHRAdmin: false };
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, is_hr_admin, line_manager_id")
    .in("id", [currentUserId, employeeId]);

  const currentProfile = profiles?.find((p) => p.id === currentUserId);
  const employeeProfile = profiles?.find((p) => p.id === employeeId);

  if (currentProfile?.is_hr_admin === true) {
    return { authorised: true, isHRAdmin: true };
  }

  if (employeeProfile?.line_manager_id !== currentUserId) {
    return {
      authorised: false,
      isHRAdmin: false,
      error: "You are not authorised to view this employee's onboarding",
    };
  }

  return { authorised: true, isHRAdmin: false };
}

// =============================================
// TEMPLATE CRUD (HR admin only)
// =============================================

export async function createTemplate(data: {
  name: string;
  description?: string;
}): Promise<{ success: boolean; error: string | null; templateId?: string }> {
  const { supabase, user } = await requireHRAdmin();

  const name = data.name?.trim();
  if (!name) {
    return { success: false, error: "Template name is required" };
  }

  const { data: template, error } = await supabase
    .from("onboarding_templates")
    .insert({
      name,
      description: data.description?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to create onboarding template", { error });
    return { success: false, error: "Failed to create template. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/onboarding/templates");
  return { success: true, error: null, templateId: template.id as string };
}

export async function updateTemplate(
  templateId: string,
  data: { name?: string; description?: string; is_active?: boolean },
): Promise<{ success: boolean; error: string | null }> {
  const { supabase } = await requireHRAdmin();

  // Whitelist fields
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) return { success: false, error: "Template name cannot be empty" };
    updates.name = name;
  }
  if (data.description !== undefined) {
    updates.description = data.description.trim() || null;
  }
  if (data.is_active !== undefined) {
    updates.is_active = data.is_active;
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: "No valid fields to update" };
  }

  // If deactivating, check no active checklists use this template
  if (data.is_active === false) {
    const { count } = await supabase
      .from("onboarding_checklists")
      .select("id", { count: "exact", head: true })
      .eq("template_id", templateId)
      .eq("status", "active");

    if (count && count > 0) {
      return {
        success: false,
        error: `Cannot deactivate: ${count} active onboarding checklist${count > 1 ? "s" : ""} use this template`,
      };
    }
  }

  const { error } = await supabase
    .from("onboarding_templates")
    .update(updates)
    .eq("id", templateId)
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to update onboarding template", { error });
    return { success: false, error: "Failed to update template. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/onboarding/templates");
  return { success: true, error: null };
}

export async function deleteTemplate(
  templateId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase } = await requireHRAdmin();

  // Check no active checklists use this template
  const { count } = await supabase
    .from("onboarding_checklists")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId)
    .eq("status", "active");

  if (count && count > 0) {
    return {
      success: false,
      error: `Cannot delete: ${count} active onboarding checklist${count > 1 ? "s" : ""} use this template`,
    };
  }

  const { error } = await supabase
    .from("onboarding_templates")
    .delete()
    .eq("id", templateId);

  if (error) {
    logger.error("Failed to delete onboarding template", { error });
    return { success: false, error: "Failed to delete template. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/onboarding/templates");
  return { success: true, error: null };
}

// =============================================
// TEMPLATE ITEM CRUD (HR admin only)
// =============================================

export async function addTemplateItem(
  templateId: string,
  data: {
    title: string;
    description?: string;
    section?: OnboardingSection;
    assignee_role?: OnboardingAssigneeRole;
    due_day_offset?: number;
  },
): Promise<{ success: boolean; error: string | null; itemId?: string }> {
  const { supabase } = await requireHRAdmin();

  const title = data.title?.trim();
  if (!title) {
    return { success: false, error: "Item title is required" };
  }
  if (title.length > 200) {
    return { success: false, error: "Item title must be 200 characters or fewer" };
  }

  const section = data.section ?? "general";
  if (!VALID_SECTIONS.includes(section)) {
    return { success: false, error: "Invalid section" };
  }

  const assigneeRole = data.assignee_role ?? "hr_admin";
  if (!VALID_ASSIGNEE_ROLES.includes(assigneeRole)) {
    return { success: false, error: "Invalid assignee role" };
  }

  // Get next sort_order for this template
  const { data: existingItems } = await supabase
    .from("onboarding_template_items")
    .select("sort_order")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSortOrder = existingItems && existingItems.length > 0
    ? ((existingItems[0].sort_order as number) + 1)
    : 0;

  const { data: item, error } = await supabase
    .from("onboarding_template_items")
    .insert({
      template_id: templateId,
      title,
      description: data.description?.trim() || null,
      section,
      assignee_role: assigneeRole,
      due_day_offset: data.due_day_offset ?? 0,
      sort_order: nextSortOrder,
    })
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to add template item", { error });
    return { success: false, error: "Failed to add item. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/onboarding/templates");
  return { success: true, error: null, itemId: item.id as string };
}

export async function updateTemplateItem(
  itemId: string,
  data: {
    title?: string;
    description?: string;
    section?: OnboardingSection;
    assignee_role?: OnboardingAssigneeRole;
    due_day_offset?: number;
  },
): Promise<{ success: boolean; error: string | null }> {
  const { supabase } = await requireHRAdmin();

  // Whitelist fields
  const updates: Record<string, unknown> = {};
  if (data.title !== undefined) {
    const title = data.title.trim();
    if (!title) return { success: false, error: "Item title cannot be empty" };
    if (title.length > 200) return { success: false, error: "Item title must be 200 characters or fewer" };
    updates.title = title;
  }
  if (data.description !== undefined) {
    updates.description = data.description.trim() || null;
  }
  if (data.section !== undefined) {
    if (!VALID_SECTIONS.includes(data.section)) {
      return { success: false, error: "Invalid section" };
    }
    updates.section = data.section;
  }
  if (data.assignee_role !== undefined) {
    if (!VALID_ASSIGNEE_ROLES.includes(data.assignee_role)) {
      return { success: false, error: "Invalid assignee role" };
    }
    updates.assignee_role = data.assignee_role;
  }
  if (data.due_day_offset !== undefined) {
    updates.due_day_offset = data.due_day_offset;
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: "No valid fields to update" };
  }

  const { error } = await supabase
    .from("onboarding_template_items")
    .update(updates)
    .eq("id", itemId)
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to update template item", { error });
    return { success: false, error: "Failed to update item. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/onboarding/templates");
  return { success: true, error: null };
}

export async function deleteTemplateItem(
  itemId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase } = await requireHRAdmin();

  const { error } = await supabase
    .from("onboarding_template_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    logger.error("Failed to delete template item", { error });
    return { success: false, error: "Failed to delete item. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/onboarding/templates");
  return { success: true, error: null };
}

export async function reorderTemplateItems(
  templateId: string,
  itemIds: string[],
): Promise<{ success: boolean; error: string | null }> {
  const { supabase } = await requireHRAdmin();

  // Batch update sort_order based on array position
  const updates = itemIds.map((id, index) =>
    supabase
      .from("onboarding_template_items")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("template_id", templateId),
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    logger.error("Failed to reorder template items", { error: failed.error.message });
    return { success: false, error: "Failed to reorder items. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/hr/onboarding/templates");
  return { success: true, error: null };
}

// =============================================
// FETCH TEMPLATES
// =============================================

export async function fetchTemplates(): Promise<OnboardingTemplate[]> {
  const { supabase } = await requireHRAdmin();

  const { data: templates } = await supabase
    .from("onboarding_templates")
    .select(ONBOARDING_TEMPLATE_SELECT)
    .order("created_at", { ascending: false });

  if (!templates) return [];

  // Get item counts per template in one query
  const templateIds = templates.map((t) => t.id as string);
  const { data: items } = await supabase
    .from("onboarding_template_items")
    .select("template_id")
    .in("template_id", templateIds);

  const countMap: Record<string, number> = {};
  for (const item of items ?? []) {
    const tid = item.template_id as string;
    countMap[tid] = (countMap[tid] ?? 0) + 1;
  }

  return templates.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    description: t.description as string | null,
    is_active: t.is_active as boolean,
    created_by: t.created_by as string | null,
    created_at: t.created_at as string,
    item_count: countMap[t.id as string] ?? 0,
  }));
}

export async function fetchTemplateItems(
  templateId: string,
): Promise<OnboardingTemplateItem[]> {
  const { supabase } = await requireHRAdmin();

  const { data } = await supabase
    .from("onboarding_template_items")
    .select(ONBOARDING_TEMPLATE_ITEM_SELECT)
    .eq("template_id", templateId)
    .order("section")
    .order("sort_order");

  if (!data) return [];

  return data.map((item) => ({
    id: item.id as string,
    template_id: item.template_id as string,
    title: item.title as string,
    description: item.description as string | null,
    section: item.section as OnboardingSection,
    assignee_role: item.assignee_role as OnboardingAssigneeRole,
    due_day_offset: item.due_day_offset as number,
    sort_order: item.sort_order as number,
  }));
}

// =============================================
// CHECKLIST CRUD (HR admin only for create/complete/cancel)
// =============================================

export async function createOnboardingChecklist(data: {
  profile_id: string;
  template_id: string;
  start_date: string;
  notes?: string;
}): Promise<{ success: boolean; error: string | null; checklistId?: string }> {
  const { supabase, user } = await requireHRAdmin();

  // Validate inputs
  if (!data.profile_id || !data.template_id || !data.start_date) {
    return { success: false, error: "Employee, template, and start date are required" };
  }

  // Validate start_date before any DB operations to prevent orphaned records
  const startDate = new Date(data.start_date + "T12:00:00");
  if (isNaN(startDate.getTime())) {
    return { success: false, error: "Invalid start date" };
  }

  // Fetch template items
  const { data: templateItems } = await supabase
    .from("onboarding_template_items")
    .select(ONBOARDING_TEMPLATE_ITEM_SELECT)
    .eq("template_id", data.template_id)
    .order("section")
    .order("sort_order");

  if (!templateItems || templateItems.length === 0) {
    return { success: false, error: "Selected template has no items. Please add items to the template first." };
  }

  // Fetch employee profile for assignee resolution
  const { data: employee } = await supabase
    .from("profiles")
    .select("id, full_name, line_manager_id")
    .eq("id", data.profile_id)
    .single();

  if (!employee) {
    return { success: false, error: "Employee not found" };
  }

  // Create the checklist
  const { data: checklist, error: checklistError } = await supabase
    .from("onboarding_checklists")
    .insert({
      profile_id: data.profile_id,
      template_id: data.template_id,
      initiated_by: user.id,
      start_date: data.start_date,
      notes: data.notes?.trim() || null,
      status: "active",
    })
    .select("id")
    .single();

  if (checklistError) {
    // Check for unique constraint violation (one active checklist per person)
    if (checklistError.code === "23505") {
      return {
        success: false,
        error: "This employee already has an active onboarding checklist. Complete or cancel it first.",
      };
    }
    logger.error("Failed to create onboarding checklist", { error: checklistError.message });
    return { success: false, error: "Failed to create checklist. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  // Create checklist items from template — resolve due dates and assignees
  // startDate already validated above
  const lineManagerId = employee.line_manager_id as string | null;

  const checklistItems = templateItems.map((item) => {
    // Resolve due date from offset
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + (item.due_day_offset as number));

    // Resolve assignee based on role
    let assigneeId: string | null = null;
    const role = item.assignee_role as OnboardingAssigneeRole;
    if (role === "hr_admin") {
      assigneeId = user.id; // The HR admin who initiated
    } else if (role === "line_manager") {
      assigneeId = lineManagerId;
    } else if (role === "employee") {
      assigneeId = data.profile_id;
    }
    // "other" stays null

    return {
      checklist_id: checklist.id as string,
      title: item.title as string,
      description: item.description as string | null,
      section: item.section as string,
      assignee_role: item.assignee_role as string,
      assignee_id: assigneeId,
      due_date: dueDate.toISOString().split("T")[0],
      sort_order: item.sort_order as number,
    };
  });

  const { error: itemsError } = await supabase
    .from("onboarding_checklist_items")
    .insert(checklistItems);

  if (itemsError) {
    // Rollback: delete the checklist we just created
    await supabase
      .from("onboarding_checklists")
      .delete()
      .eq("id", checklist.id as string);

    logger.error("Failed to create checklist items", { error: itemsError.message });
    return { success: false, error: "Failed to create checklist items. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  // Notify employee (non-critical)
  try {
    const employeeName = employee.full_name as string;
    await createNotification({
      userId: data.profile_id,
      type: "onboarding_started",
      title: "Onboarding Started",
      message: `Your onboarding checklist has been created. Start date: ${formatHRDate(data.start_date)}.`,
      link: `/hr/onboarding/${checklist.id as string}`,
      metadata: { checklist_id: checklist.id, profile_id: data.profile_id },
    });

    // Notify line manager if different from initiator
    if (lineManagerId && lineManagerId !== user.id) {
      await createNotification({
        userId: lineManagerId,
        type: "onboarding_started",
        title: "New Starter Onboarding",
        message: `An onboarding checklist has been created for ${employeeName}. Start date: ${formatHRDate(data.start_date)}.`,
        link: `/hr/onboarding/${checklist.id as string}`,
        metadata: { checklist_id: checklist.id, profile_id: data.profile_id },
      });
    }
  } catch {
    // Notification failure is non-critical — log but don't fail the action
    console.warn("Failed to send onboarding notifications");
  }

  revalidateOnboardingPaths(data.profile_id);
  return { success: true, error: null, checklistId: checklist.id as string };
}

export async function completeOnboardingChecklist(
  checklistId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await requireHRAdmin();

  // Fetch checklist
  const { data: checklist } = await supabase
    .from("onboarding_checklists")
    .select(ONBOARDING_CHECKLIST_SELECT)
    .eq("id", checklistId)
    .single();

  if (!checklist) {
    return { success: false, error: "Onboarding checklist not found" };
  }

  if ((checklist.status as string) !== "active") {
    return { success: false, error: "This checklist is no longer active" };
  }

  // Verify all items are complete
  const { count: incompleteCount } = await supabase
    .from("onboarding_checklist_items")
    .select("id", { count: "exact", head: true })
    .eq("checklist_id", checklistId)
    .eq("is_completed", false);

  if (incompleteCount && incompleteCount > 0) {
    return {
      success: false,
      error: `${incompleteCount} item${incompleteCount > 1 ? "s" : ""} still incomplete. Complete all items first.`,
    };
  }

  // Update with race condition guard
  const { error: updateError } = await supabase
    .from("onboarding_checklists")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: user.id,
    })
    .eq("id", checklistId)
    .eq("status", "active")
    .select("id")
    .single();

  if (updateError) {
    return { success: false, error: "Could not complete checklist. It may have already been completed." };
  }

  const profileId = checklist.profile_id as string;

  // Notify employee (non-critical)
  try {
    await createNotification({
      userId: profileId,
      type: "onboarding_completed",
      title: "Onboarding Complete",
      message: "Your onboarding has been marked as complete. Welcome aboard!",
      link: `/hr/onboarding/${checklistId}`,
      metadata: { checklist_id: checklistId, profile_id: profileId },
    });
  } catch {
    console.warn("Failed to send onboarding completion notification");
  }

  revalidateOnboardingPaths(profileId);
  return { success: true, error: null };
}

export async function cancelOnboardingChecklist(
  checklistId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase } = await requireHRAdmin();

  const { data: checklist } = await supabase
    .from("onboarding_checklists")
    .select("id, profile_id, status")
    .eq("id", checklistId)
    .single();

  if (!checklist) {
    return { success: false, error: "Onboarding checklist not found" };
  }

  if ((checklist.status as string) !== "active") {
    return { success: false, error: "Only active checklists can be cancelled" };
  }

  const { error } = await supabase
    .from("onboarding_checklists")
    .update({ status: "cancelled" })
    .eq("id", checklistId)
    .eq("status", "active")
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Could not cancel checklist. It may have already been cancelled." };
  }

  revalidateOnboardingPaths(checklist.profile_id as string);
  return { success: true, error: null };
}

// =============================================
// ITEM MANAGEMENT (HR admin + line manager)
// =============================================

export async function toggleChecklistItem(
  itemId: string,
  completed: boolean,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch the item and its checklist to verify authority
  const { data: item } = await supabase
    .from("onboarding_checklist_items")
    .select("id, checklist_id")
    .eq("id", itemId)
    .single();

  if (!item) {
    return { success: false, error: "Checklist item not found" };
  }

  const { data: checklist } = await supabase
    .from("onboarding_checklists")
    .select("id, profile_id, status")
    .eq("id", item.checklist_id as string)
    .single();

  if (!checklist) {
    return { success: false, error: "Checklist not found" };
  }

  if ((checklist.status as string) !== "active") {
    return { success: false, error: "This checklist is no longer active" };
  }

  // Authority check: HR admin OR line manager of the employee
  const auth = await verifyOnboardingAuthority(
    supabase,
    user.id,
    checklist.profile_id as string,
  );

  if (!auth.authorised) {
    return { success: false, error: auth.error ?? "Not authorised" };
  }

  const updates: Record<string, unknown> = {
    is_completed: completed,
    completed_at: completed ? new Date().toISOString() : null,
    completed_by: completed ? user.id : null,
  };

  const { error } = await supabase
    .from("onboarding_checklist_items")
    .update(updates)
    .eq("id", itemId)
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to update checklist item", { error });
    return { success: false, error: "Failed to update item. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidateOnboardingPaths(checklist.profile_id as string);
  return { success: true, error: null };
}

export async function addChecklistItem(
  checklistId: string,
  data: {
    title: string;
    description?: string;
    section?: OnboardingSection;
    assignee_role?: OnboardingAssigneeRole;
    due_date?: string;
  },
): Promise<{ success: boolean; error: string | null; itemId?: string }> {
  const { supabase } = await requireHRAdmin();

  const title = data.title?.trim();
  if (!title) {
    return { success: false, error: "Item title is required" };
  }

  // Verify checklist is active
  const { data: checklist } = await supabase
    .from("onboarding_checklists")
    .select("id, status")
    .eq("id", checklistId)
    .single();

  if (!checklist) {
    return { success: false, error: "Checklist not found" };
  }

  if ((checklist.status as string) !== "active") {
    return { success: false, error: "Cannot add items to a non-active checklist" };
  }

  const section = data.section ?? "general";
  if (!VALID_SECTIONS.includes(section)) {
    return { success: false, error: "Invalid section" };
  }

  const assigneeRole = data.assignee_role ?? "hr_admin";
  if (!VALID_ASSIGNEE_ROLES.includes(assigneeRole)) {
    return { success: false, error: "Invalid assignee role" };
  }

  // Get next sort_order
  const { data: existingItems } = await supabase
    .from("onboarding_checklist_items")
    .select("sort_order")
    .eq("checklist_id", checklistId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSortOrder = existingItems && existingItems.length > 0
    ? ((existingItems[0].sort_order as number) + 1)
    : 0;

  const { data: item, error } = await supabase
    .from("onboarding_checklist_items")
    .insert({
      checklist_id: checklistId,
      title,
      description: data.description?.trim() || null,
      section,
      assignee_role: assigneeRole,
      due_date: data.due_date || null,
      sort_order: nextSortOrder,
    })
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to add checklist item", { error });
    return { success: false, error: "Failed to add item. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/hr/onboarding/${checklistId}`);
  revalidatePath("/hr/onboarding");
  return { success: true, error: null, itemId: item.id as string };
}

// =============================================
// FETCH ACTIONS
// =============================================

export async function fetchOnboardingDashboard(): Promise<OnboardingChecklistWithProgress[]> {
  const { supabase } = await requireHRAdmin();

  // Fetch all checklists with employee profile info
  const { data: checklists } = await supabase
    .from("onboarding_checklists")
    .select(`
      ${ONBOARDING_CHECKLIST_SELECT},
      profiles!onboarding_checklists_profile_id_fkey(full_name, avatar_url, job_title, department),
      onboarding_templates(name)
    `)
    .order("created_at", { ascending: false });

  if (!checklists || checklists.length === 0) return [];

  // Fetch all items for these checklists in one query
  const checklistIds = checklists.map((c) => c.id as string);
  const { data: allItems } = await supabase
    .from("onboarding_checklist_items")
    .select("checklist_id, is_completed, due_date")
    .in("checklist_id", checklistIds);

  // Build progress maps
  const today = new Date().toISOString().split("T")[0];
  const progressMap: Record<string, { total: number; completed: number; overdue: number }> = {};
  for (const item of allItems ?? []) {
    const cid = item.checklist_id as string;
    if (!progressMap[cid]) {
      progressMap[cid] = { total: 0, completed: 0, overdue: 0 };
    }
    progressMap[cid].total++;
    if (item.is_completed) {
      progressMap[cid].completed++;
    } else if (item.due_date && (item.due_date as string) < today) {
      progressMap[cid].overdue++;
    }
  }

  return checklists.map((c) => {
    const profile = c.profiles as unknown as {
      full_name: string;
      avatar_url: string | null;
      job_title: string | null;
      department: string | null;
    } | null;
    const template = c.onboarding_templates as unknown as { name: string } | null;
    const progress = progressMap[c.id as string] ?? { total: 0, completed: 0, overdue: 0 };

    return {
      id: c.id as string,
      profile_id: c.profile_id as string,
      template_id: c.template_id as string | null,
      initiated_by: c.initiated_by as string,
      status: c.status as OnboardingChecklist["status"],
      start_date: c.start_date as string,
      notes: c.notes as string | null,
      completed_at: c.completed_at as string | null,
      completed_by: c.completed_by as string | null,
      created_at: c.created_at as string,
      employee_name: profile?.full_name ?? "Unknown",
      employee_avatar: profile?.avatar_url ?? null,
      employee_job_title: profile?.job_title ?? null,
      employee_department: profile?.department ?? null,
      template_name: template?.name ?? null,
      total_items: progress.total,
      completed_items: progress.completed,
      overdue_items: progress.overdue,
    };
  });
}

export async function fetchChecklistDetail(
  checklistId: string,
): Promise<{
  checklist: OnboardingChecklistWithProgress | null;
  items: OnboardingChecklistItem[];
}> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { checklist: null, items: [] };
  }

  // Fetch checklist with profile info
  const { data: c } = await supabase
    .from("onboarding_checklists")
    .select(`
      ${ONBOARDING_CHECKLIST_SELECT},
      profiles!onboarding_checklists_profile_id_fkey(full_name, avatar_url, job_title, department),
      onboarding_templates(name)
    `)
    .eq("id", checklistId)
    .single();

  if (!c) {
    return { checklist: null, items: [] };
  }

  // Verify authority
  const auth = await verifyOnboardingAuthority(supabase, user.id, c.profile_id as string);
  if (!auth.authorised) {
    return { checklist: null, items: [] };
  }

  // Fetch items
  const { data: rawItems } = await supabase
    .from("onboarding_checklist_items")
    .select(ONBOARDING_CHECKLIST_ITEM_SELECT)
    .eq("checklist_id", checklistId)
    .order("section")
    .order("sort_order");

  const items: OnboardingChecklistItem[] = (rawItems ?? []).map((item) => ({
    id: item.id as string,
    checklist_id: item.checklist_id as string,
    title: item.title as string,
    description: item.description as string | null,
    section: item.section as OnboardingSection,
    assignee_role: item.assignee_role as OnboardingAssigneeRole,
    assignee_id: item.assignee_id as string | null,
    due_date: item.due_date as string | null,
    sort_order: item.sort_order as number,
    is_completed: item.is_completed as boolean,
    completed_at: item.completed_at as string | null,
    completed_by: item.completed_by as string | null,
  }));

  const today = new Date().toISOString().split("T")[0];
  const profile = c.profiles as unknown as {
    full_name: string;
    avatar_url: string | null;
    job_title: string | null;
    department: string | null;
  } | null;
  const template = c.onboarding_templates as unknown as { name: string } | null;

  const totalItems = items.length;
  const completedItems = items.filter((i) => i.is_completed).length;
  const overdueItems = items.filter((i) => !i.is_completed && i.due_date && i.due_date < today).length;

  const checklist: OnboardingChecklistWithProgress = {
    id: c.id as string,
    profile_id: c.profile_id as string,
    template_id: c.template_id as string | null,
    initiated_by: c.initiated_by as string,
    status: c.status as OnboardingChecklist["status"],
    start_date: c.start_date as string,
    notes: c.notes as string | null,
    completed_at: c.completed_at as string | null,
    completed_by: c.completed_by as string | null,
    created_at: c.created_at as string,
    employee_name: profile?.full_name ?? "Unknown",
    employee_avatar: profile?.avatar_url ?? null,
    employee_job_title: profile?.job_title ?? null,
    employee_department: profile?.department ?? null,
    template_name: template?.name ?? null,
    total_items: totalItems,
    completed_items: completedItems,
    overdue_items: overdueItems,
  };

  return { checklist, items };
}

export async function fetchEmployeeOnboarding(
  profileId: string,
): Promise<{
  active: OnboardingChecklistWithProgress | null;
  history: OnboardingChecklistWithProgress[];
}> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { active: null, history: [] };
  }

  // Authority check
  const auth = await verifyOnboardingAuthority(supabase, user.id, profileId);
  if (!auth.authorised) {
    return { active: null, history: [] };
  }

  // Fetch all checklists for this employee
  const { data: checklists } = await supabase
    .from("onboarding_checklists")
    .select(`
      ${ONBOARDING_CHECKLIST_SELECT},
      onboarding_templates(name)
    `)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (!checklists || checklists.length === 0) {
    return { active: null, history: [] };
  }

  // Fetch items for progress
  const checklistIds = checklists.map((c) => c.id as string);
  const { data: allItems } = await supabase
    .from("onboarding_checklist_items")
    .select("checklist_id, is_completed, due_date")
    .in("checklist_id", checklistIds);

  const today = new Date().toISOString().split("T")[0];
  const progressMap: Record<string, { total: number; completed: number; overdue: number }> = {};
  for (const item of allItems ?? []) {
    const cid = item.checklist_id as string;
    if (!progressMap[cid]) {
      progressMap[cid] = { total: 0, completed: 0, overdue: 0 };
    }
    progressMap[cid].total++;
    if (item.is_completed) {
      progressMap[cid].completed++;
    } else if (item.due_date && (item.due_date as string) < today) {
      progressMap[cid].overdue++;
    }
  }

  // Fetch employee profile once
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, job_title, department")
    .eq("id", profileId)
    .single();

  const mapped: OnboardingChecklistWithProgress[] = checklists.map((c) => {
    const template = c.onboarding_templates as unknown as { name: string } | null;
    const progress = progressMap[c.id as string] ?? { total: 0, completed: 0, overdue: 0 };

    return {
      id: c.id as string,
      profile_id: c.profile_id as string,
      template_id: c.template_id as string | null,
      initiated_by: c.initiated_by as string,
      status: c.status as OnboardingChecklist["status"],
      start_date: c.start_date as string,
      notes: c.notes as string | null,
      completed_at: c.completed_at as string | null,
      completed_by: c.completed_by as string | null,
      created_at: c.created_at as string,
      employee_name: (profile?.full_name as string) ?? "Unknown",
      employee_avatar: (profile?.avatar_url as string | null) ?? null,
      employee_job_title: (profile?.job_title as string | null) ?? null,
      employee_department: (profile?.department as string | null) ?? null,
      template_name: template?.name ?? null,
      total_items: progress.total,
      completed_items: progress.completed,
      overdue_items: progress.overdue,
    };
  });

  const active = mapped.find((c) => c.status === "active") ?? null;
  const history = mapped.filter((c) => c.status !== "active");

  return { active, history };
}

// =============================================
// FETCH ACTIVE TEMPLATES (for create dialog)
// =============================================

export async function fetchActiveTemplates(): Promise<
  Array<{ id: string; name: string; description: string | null; item_count: number }>
> {
  const { supabase } = await requireHRAdmin();

  const { data: templates } = await supabase
    .from("onboarding_templates")
    .select("id, name, description")
    .eq("is_active", true)
    .order("name");

  if (!templates) return [];

  // Get item counts
  const templateIds = templates.map((t) => t.id as string);
  const { data: items } = await supabase
    .from("onboarding_template_items")
    .select("template_id")
    .in("template_id", templateIds);

  const countMap: Record<string, number> = {};
  for (const item of items ?? []) {
    const tid = item.template_id as string;
    countMap[tid] = (countMap[tid] ?? 0) + 1;
  }

  return templates.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    description: t.description as string | null,
    item_count: countMap[t.id as string] ?? 0,
  }));
}
