"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CourseCategory } from "@/types/database.types";

// ===========================================
// EXTERNAL COURSE CRUD
// ===========================================

const EXTERNAL_COURSE_FIELDS = [
  "title",
  "provider",
  "category",
  "completed_at",
  "duration_minutes",
  "certificate_url",
  "notes",
] as const;

/** Sanitize and trim external course data using the allowed fields whitelist */
function sanitizeExternalCourseData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const field of EXTERNAL_COURSE_FIELDS) {
    if (field in data) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  // Trim string fields, convert empty strings to null
  for (const key of ["title", "provider", "certificate_url", "notes"]) {
    if (typeof sanitized[key] === "string") {
      const trimmed = (sanitized[key] as string).trim();
      sanitized[key] = key === "title" ? trimmed : trimmed || null;
    }
  }

  return sanitized;
}

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

  const sanitized = sanitizeExternalCourseData(data as Record<string, unknown>);
  sanitized.user_id = user.id;

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

  const sanitized = sanitizeExternalCourseData(data as Record<string, unknown>);

  if (Object.keys(sanitized).length === 0) {
    return { success: false, error: "No valid fields to update" };
  }

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
