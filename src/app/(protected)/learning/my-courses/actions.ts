"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CourseCategory } from "@/types/database.types";

// ===========================================
// EXTERNAL COURSE CRUD
// ===========================================

export async function addExternalCourse(data: {
  title: string;
  provider?: string | null;
  category?: CourseCategory | null;
  completed_at: string;
  duration_minutes?: number | null;
  certificate_url?: string | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Validate required fields
  if (!data.title?.trim()) {
    return { success: false, error: "Title is required" };
  }
  if (!data.completed_at) {
    return { success: false, error: "Completion date is required" };
  }

  const ALLOWED_FIELDS = [
    "title",
    "provider",
    "category",
    "completed_at",
    "duration_minutes",
    "certificate_url",
    "notes",
  ] as const;

  const sanitized: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in data) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  sanitized.user_id = user.id;

  // Trim string fields
  if (typeof sanitized.title === "string") sanitized.title = sanitized.title.trim();
  if (typeof sanitized.provider === "string") sanitized.provider = sanitized.provider.trim() || null;
  if (typeof sanitized.certificate_url === "string") sanitized.certificate_url = sanitized.certificate_url.trim() || null;
  if (typeof sanitized.notes === "string") sanitized.notes = sanitized.notes.trim() || null;

  const { error } = await supabase.from("external_courses").insert(sanitized);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/learning/my-courses");
  return { success: true, error: null };
}

export async function updateExternalCourse(
  courseId: string,
  data: {
    title?: string;
    provider?: string | null;
    category?: CourseCategory | null;
    completed_at?: string;
    duration_minutes?: number | null;
    certificate_url?: string | null;
    notes?: string | null;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const ALLOWED_FIELDS = [
    "title",
    "provider",
    "category",
    "completed_at",
    "duration_minutes",
    "certificate_url",
    "notes",
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

  // Trim string fields
  if (typeof sanitized.title === "string") sanitized.title = sanitized.title.trim();
  if (typeof sanitized.provider === "string") sanitized.provider = sanitized.provider.trim() || null;
  if (typeof sanitized.certificate_url === "string") sanitized.certificate_url = sanitized.certificate_url.trim() || null;
  if (typeof sanitized.notes === "string") sanitized.notes = sanitized.notes.trim() || null;

  const { error } = await supabase
    .from("external_courses")
    .update(sanitized)
    .eq("id", courseId)
    .eq("user_id", user.id); // RLS + explicit check

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/learning/my-courses");
  return { success: true, error: null };
}

export async function deleteExternalCourse(courseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase
    .from("external_courses")
    .delete()
    .eq("id", courseId)
    .eq("user_id", user.id); // RLS + explicit check

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/learning/my-courses");
  return { success: true, error: null };
}
