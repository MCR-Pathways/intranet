"use server";

import { requireLDAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { CourseCategory, LessonType } from "@/types/database.types";

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

  if (Object.keys(sanitized).length === 0) {
    return { success: false, error: "No valid fields to update" };
  }

  // Track who modified the course
  sanitized.updated_by = user.id;

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
  video_storage_path?: string | null;
  lesson_type?: LessonType;
  passing_score?: number | null;
  sort_order: number;
}) {
  const { supabase } = await requireLDAdmin();

  const ALLOWED_FIELDS = [
    "course_id",
    "title",
    "content",
    "video_url",
    "video_storage_path",
    "lesson_type",
    "passing_score",
    "sort_order",
  ] as const;

  const sanitized: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in data) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  // Server-side content validation
  if (data.lesson_type === "text") {
    const c = data.content;
    if (!c || !c.trim()) {
      return { success: false, error: "Text content cannot be empty", lessonId: null };
    }
  }
  if (data.lesson_type === "video") {
    if (!data.video_url && !data.video_storage_path) {
      return { success: false, error: "Video URL or uploaded video is required", lessonId: null };
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
    video_storage_path?: string | null;
    lesson_type?: LessonType;
    passing_score?: number | null;
    sort_order?: number;
    is_active?: boolean;
  }
) {
  const { supabase } = await requireLDAdmin();

  const ALLOWED_FIELDS = [
    "title",
    "content",
    "video_url",
    "video_storage_path",
    "lesson_type",
    "passing_score",
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

  // Server-side content validation
  const lessonType = data.lesson_type;
  if (lessonType === "text") {
    const c = data.content;
    if (!c || !c.trim()) {
      return { success: false, error: "Text content cannot be empty" };
    }
  }
  if (lessonType === "video") {
    if (!data.video_url && !data.video_storage_path) {
      return { success: false, error: "Video URL or uploaded video is required" };
    }
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

  const results = await Promise.all(
    lessonOrders.map(({ id, sort_order }) =>
      supabase.from("course_lessons").update({ sort_order }).eq("id", id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { success: false, error: failed.error.message };
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

// ===========================================
// VIDEO UPLOAD
// ===========================================

export async function uploadCourseVideo(formData: FormData) {
  const { supabase, user } = await requireLDAdmin();

  const file = formData.get("file") as File | null;
  const courseId = formData.get("courseId") as string | null;

  if (!file) {
    return { success: false, error: "No file provided", url: null, storagePath: null };
  }
  if (!courseId) {
    return { success: false, error: "No course ID provided", url: null, storagePath: null };
  }

  // Max 50MB
  if (file.size > 52428800) {
    return { success: false, error: "File too large (max 50MB)", url: null, storagePath: null };
  }

  const allowedTypes = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      error: "Invalid video type. Allowed: MP4, WebM, OGG, QuickTime",
      url: null,
      storagePath: null,
    };
  }

  const fileExt = file.name.split(".").pop() || "mp4";
  const uniqueName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `${user.id}/${uniqueName}`;

  const { error: uploadError } = await supabase.storage
    .from("course-videos")
    .upload(filePath, file);

  if (uploadError) {
    return { success: false, error: uploadError.message, url: null, storagePath: null };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("course-videos").getPublicUrl(filePath);

  return { success: true, error: null, url: publicUrl, storagePath: filePath };
}

// ===========================================
// QUIZ QUESTION CRUD
// ===========================================

export async function createQuizQuestion(data: {
  lesson_id: string;
  course_id: string;
  question_text: string;
  sort_order: number;
  options: { option_text: string; is_correct: boolean; sort_order: number }[];
}) {
  const { supabase } = await requireLDAdmin();

  // Validate at least 2 options
  if (data.options.length < 2) {
    return { success: false, error: "At least 2 options are required", questionId: null };
  }

  // Validate exactly 1 correct answer
  const correctCount = data.options.filter((o) => o.is_correct).length;
  if (correctCount !== 1) {
    return { success: false, error: "Exactly one correct answer is required", questionId: null };
  }

  // Insert question
  const { data: question, error: qError } = await supabase
    .from("quiz_questions")
    .insert({
      lesson_id: data.lesson_id,
      question_text: data.question_text,
      sort_order: data.sort_order,
    })
    .select("id")
    .single();

  if (qError) {
    return { success: false, error: qError.message, questionId: null };
  }

  // Insert options
  const options = data.options.map((opt, i) => ({
    question_id: question.id,
    option_text: opt.option_text,
    is_correct: opt.is_correct,
    sort_order: opt.sort_order ?? i,
  }));

  const { error: oError } = await supabase.from("quiz_options").insert(options);

  if (oError) {
    // Cleanup question if options failed
    await supabase.from("quiz_questions").delete().eq("id", question.id);
    return { success: false, error: oError.message, questionId: null };
  }

  revalidatePath(`/learning/admin/courses/${data.course_id}`);
  revalidatePath(`/learning/courses/${data.course_id}`);
  return { success: true, error: null, questionId: question.id };
}

export async function updateQuizQuestion(
  questionId: string,
  courseId: string,
  data: {
    question_text?: string;
    options?: { option_text: string; is_correct: boolean; sort_order: number }[];
  }
) {
  const { supabase } = await requireLDAdmin();

  if (data.question_text) {
    const { error } = await supabase
      .from("quiz_questions")
      .update({ question_text: data.question_text })
      .eq("id", questionId);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  if (data.options) {
    // Validate options
    if (data.options.length < 2) {
      return { success: false, error: "At least 2 options are required" };
    }
    const correctCount = data.options.filter((o) => o.is_correct).length;
    if (correctCount !== 1) {
      return { success: false, error: "Exactly one correct answer is required" };
    }

    // Replace all options: delete existing, insert new set
    await supabase.from("quiz_options").delete().eq("question_id", questionId);

    const newOptions = data.options.map((opt, i) => ({
      question_id: questionId,
      option_text: opt.option_text,
      is_correct: opt.is_correct,
      sort_order: opt.sort_order ?? i,
    }));

    const { error } = await supabase.from("quiz_options").insert(newOptions);
    if (error) {
      return { success: false, error: error.message };
    }
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
  return { success: true, error: null };
}

export async function deleteQuizQuestion(questionId: string, courseId: string) {
  const { supabase } = await requireLDAdmin();

  const { error } = await supabase
    .from("quiz_questions")
    .delete()
    .eq("id", questionId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
  return { success: true, error: null };
}
