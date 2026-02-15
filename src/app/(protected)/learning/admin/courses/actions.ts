"use server";

import { requireLDAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { CourseCategory } from "@/types/database.types";

// ===========================================
// COURSE CRUD
// ===========================================

export async function createCourse(data: {
  title: string;
  description?: string | null;
  category: CourseCategory;
  duration_minutes?: number | null;
  is_required?: boolean;
  passing_score?: number | null;
  due_days_from_start?: number | null;
  content_url?: string | null;
  is_active?: boolean;
}) {
  const { supabase, user } = await requireLDAdmin();

  const ALLOWED_FIELDS = [
    "title",
    "description",
    "category",
    "duration_minutes",
    "is_required",
    "passing_score",
    "due_days_from_start",
    "content_url",
    "is_active",
  ] as const;

  const sanitized: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in data) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  sanitized.created_by = user.id;

  const { data: course, error } = await supabase
    .from("courses")
    .insert(sanitized)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message, courseId: null };
  }

  revalidatePath("/learning/admin/courses");
  revalidatePath("/learning/courses");
  return { success: true, error: null, courseId: course.id };
}

export async function updateCourse(
  courseId: string,
  data: {
    title?: string;
    description?: string | null;
    category?: CourseCategory;
    duration_minutes?: number | null;
    is_required?: boolean;
    passing_score?: number | null;
    due_days_from_start?: number | null;
    content_url?: string | null;
    is_active?: boolean;
  }
) {
  const { supabase } = await requireLDAdmin();

  const ALLOWED_FIELDS = [
    "title",
    "description",
    "category",
    "duration_minutes",
    "is_required",
    "passing_score",
    "due_days_from_start",
    "content_url",
    "is_active",
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
    .from("courses")
    .update(sanitized)
    .eq("id", courseId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/learning/admin/courses");
  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath("/learning/courses");
  return { success: true, error: null };
}

export async function toggleCourseActive(courseId: string, isActive: boolean) {
  const { supabase } = await requireLDAdmin();

  const { error } = await supabase
    .from("courses")
    .update({ is_active: isActive })
    .eq("id", courseId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/learning/admin/courses");
  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath("/learning/courses");
  return { success: true, error: null };
}

// ===========================================
// LESSON CRUD
// ===========================================

export async function createLesson(data: {
  course_id: string;
  title: string;
  content?: string | null;
  video_url?: string | null;
  sort_order: number;
}) {
  const { supabase } = await requireLDAdmin();

  const ALLOWED_FIELDS = [
    "course_id",
    "title",
    "content",
    "video_url",
    "sort_order",
  ] as const;

  const sanitized: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in data) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  const { data: lesson, error } = await supabase
    .from("course_lessons")
    .insert(sanitized)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message, lessonId: null };
  }

  revalidatePath(`/learning/admin/courses/${data.course_id}`);
  revalidatePath(`/learning/courses/${data.course_id}`);
  return { success: true, error: null, lessonId: lesson.id };
}

export async function updateLesson(
  lessonId: string,
  courseId: string,
  data: {
    title?: string;
    content?: string | null;
    video_url?: string | null;
    sort_order?: number;
    is_active?: boolean;
  }
) {
  const { supabase } = await requireLDAdmin();

  const ALLOWED_FIELDS = [
    "title",
    "content",
    "video_url",
    "sort_order",
    "is_active",
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
    .from("course_lessons")
    .update(sanitized)
    .eq("id", lessonId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
  return { success: true, error: null };
}

export async function deleteLesson(lessonId: string, courseId: string) {
  const { supabase } = await requireLDAdmin();

  const { error } = await supabase
    .from("course_lessons")
    .delete()
    .eq("id", lessonId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
  return { success: true, error: null };
}

export async function reorderLessons(
  courseId: string,
  lessonOrders: { id: string; sort_order: number }[]
) {
  const { supabase } = await requireLDAdmin();

  for (const { id, sort_order } of lessonOrders) {
    const { error } = await supabase
      .from("course_lessons")
      .update({ sort_order })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
  return { success: true, error: null };
}

// ===========================================
// COURSE ASSIGNMENTS
// ===========================================

export async function assignCourse(data: {
  course_id: string;
  assign_type: string;
  assign_value: string;
}) {
  const { supabase, user } = await requireLDAdmin();

  if (!["team", "user_type"].includes(data.assign_type)) {
    return { success: false, error: "Invalid assignment type" };
  }

  const { error } = await supabase.from("course_assignments").insert({
    course_id: data.course_id,
    assign_type: data.assign_type,
    assign_value: data.assign_value,
    assigned_by: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "This assignment already exists" };
    }
    return { success: false, error: error.message };
  }

  revalidatePath(`/learning/admin/courses/${data.course_id}`);
  return { success: true, error: null };
}

export async function removeAssignment(assignmentId: string, courseId: string) {
  const { supabase } = await requireLDAdmin();

  const { error } = await supabase
    .from("course_assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  return { success: true, error: null };
}
