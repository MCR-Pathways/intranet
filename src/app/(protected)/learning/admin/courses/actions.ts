"use server";

import { requireLDAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { CourseCategory, LessonType, QuestionType } from "@/types/database.types";

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
  ] as const;

  const sanitized: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in data) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  sanitized.created_by = user.id;
  // New courses always start as drafts (DB default), not active
  sanitized.is_active = false;

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
    status?: "draft" | "published";
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
    "status",
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
// PUBLISH / UNPUBLISH
// ===========================================

export async function publishCourse(courseId: string) {
  const { supabase, user } = await requireLDAdmin();

  // Validate: course must have at least 1 active lesson
  const { data: lessons } = await supabase
    .from("course_lessons")
    .select("id, title, lesson_type")
    .eq("course_id", courseId)
    .eq("is_active", true);

  if (!lessons || lessons.length === 0) {
    return { success: false, error: "Add at least one lesson before publishing." };
  }

  // Validate: quiz lessons must have at least 1 question
  const quizLessons = lessons.filter((l) => l.lesson_type === "quiz");
  for (const quiz of quizLessons) {
    const { count } = await supabase
      .from("quiz_questions")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", quiz.id);

    if (!count || count === 0) {
      return {
        success: false,
        error: `Quiz "${quiz.title}" needs at least one question before publishing.`,
      };
    }
  }

  const { error } = await supabase
    .from("courses")
    .update({ status: "published", is_active: true, updated_by: user.id })
    .eq("id", courseId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/learning/admin/courses");
  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath("/learning/courses");
  revalidatePath("/learning");
  return { success: true, error: null };
}

export async function unpublishCourse(courseId: string) {
  const { supabase, user } = await requireLDAdmin();

  // Block if there are enrollments
  const { count } = await supabase
    .from("course_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);

  if (count && count > 0) {
    return {
      success: false,
      error: `Cannot revert to draft: ${count} learner${count > 1 ? "s" : ""} enrolled. Deactivate instead.`,
    };
  }

  const { error } = await supabase
    .from("courses")
    .update({ status: "draft", is_active: false, updated_by: user.id })
    .eq("id", courseId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/learning/admin/courses");
  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath("/learning/courses");
  revalidatePath("/learning");
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
    // Validate URL protocol (prevent javascript: injection)
    if (data.video_url) {
      try {
        const parsed = new URL(data.video_url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          return { success: false, error: "Video URL must use https:// or http://", lessonId: null };
        }
      } catch {
        return { success: false, error: "Invalid video URL", lessonId: null };
      }
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
    // Validate URL protocol (prevent javascript: injection)
    if (data.video_url) {
      try {
        const parsed = new URL(data.video_url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          return { success: false, error: "Video URL must use https:// or http://" };
        }
      } catch {
        return { success: false, error: "Invalid video URL" };
      }
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

  // Clean up associated images from storage before deleting lesson
  const { data: images } = await supabase
    .from("lesson_images")
    .select("storage_path")
    .eq("lesson_id", lessonId);

  if (images && images.length > 0) {
    const paths = images.map((img) => img.storage_path);
    await supabase.storage.from("lesson-images").remove(paths);
  }

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
// LESSON IMAGE UPLOAD
// ===========================================

export async function uploadLessonImage(formData: FormData) {
  const { supabase } = await requireLDAdmin();

  const file = formData.get("file") as File | null;
  const lessonId = formData.get("lessonId") as string | null;
  const courseId = formData.get("courseId") as string | null;

  if (!file) {
    return { success: false, error: "No file provided", image: null };
  }
  if (!lessonId || !courseId) {
    return { success: false, error: "Missing lesson or course ID", image: null };
  }

  // Max 5MB
  if (file.size > 5242880) {
    return { success: false, error: "File too large (max 5MB)", image: null };
  }

  const allowedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      error: "Invalid image type. Allowed: PNG, JPEG, GIF, WebP, SVG",
      image: null,
    };
  }

  const fileExt = file.name.split(".").pop() || "png";
  const uniqueName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `${courseId}/${lessonId}/${uniqueName}`;

  const { error: uploadError } = await supabase.storage
    .from("lesson-images")
    .upload(filePath, file);

  if (uploadError) {
    return { success: false, error: uploadError.message, image: null };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("lesson-images").getPublicUrl(filePath);

  // Get current max sort order
  const { data: existing } = await supabase
    .from("lesson_images")
    .select("sort_order")
    .eq("lesson_id", lessonId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data: imageRow, error: insertError } = await supabase
    .from("lesson_images")
    .insert({
      lesson_id: lessonId,
      file_name: file.name,
      file_url: publicUrl,
      storage_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      sort_order: nextOrder,
    })
    .select("id, lesson_id, file_name, file_url, storage_path, file_size, mime_type, sort_order, created_at")
    .single();

  if (insertError) {
    // Cleanup uploaded file if DB insert fails
    await supabase.storage.from("lesson-images").remove([filePath]);
    return { success: false, error: insertError.message, image: null };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
  return { success: true, error: null, image: imageRow };
}

export async function deleteLessonImage(imageId: string, courseId: string) {
  const { supabase } = await requireLDAdmin();

  // Get the storage path first
  const { data: image } = await supabase
    .from("lesson_images")
    .select("storage_path")
    .eq("id", imageId)
    .single();

  if (!image) {
    return { success: false, error: "Image not found" };
  }

  // Delete from storage
  await supabase.storage.from("lesson-images").remove([image.storage_path]);

  // Delete from DB
  const { error } = await supabase
    .from("lesson_images")
    .delete()
    .eq("id", imageId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
  return { success: true, error: null };
}

// ===========================================
// QUIZ QUESTION CRUD
// ===========================================

export async function createQuizQuestion(data: {
  lesson_id: string;
  course_id: string;
  question_text: string;
  question_type?: QuestionType;
  sort_order: number;
  options: { option_text: string; is_correct: boolean; sort_order: number }[];
}) {
  const { supabase } = await requireLDAdmin();

  const questionType = data.question_type ?? "single";

  // Validate at least 2 options
  if (data.options.length < 2) {
    return { success: false, error: "At least 2 options are required", questionId: null };
  }

  // Validate correct answer count based on question type
  const correctCount = data.options.filter((o) => o.is_correct).length;
  if (questionType === "single") {
    if (correctCount !== 1) {
      return { success: false, error: "Exactly one correct answer is required", questionId: null };
    }
  } else {
    // Multi-answer: need at least 1 correct AND at least 1 incorrect
    if (correctCount < 1) {
      return { success: false, error: "At least one correct answer is required", questionId: null };
    }
    const incorrectCount = data.options.length - correctCount;
    if (incorrectCount < 1) {
      return { success: false, error: "At least one incorrect option is required", questionId: null };
    }
  }

  // Insert question
  const { data: question, error: qError } = await supabase
    .from("quiz_questions")
    .insert({
      lesson_id: data.lesson_id,
      question_text: data.question_text,
      question_type: questionType,
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
    question_type?: QuestionType;
    options?: { option_text: string; is_correct: boolean; sort_order: number }[];
  }
) {
  const { supabase } = await requireLDAdmin();

  // Build update payload for question itself
  const questionUpdate: Record<string, unknown> = {};
  if (data.question_text) {
    questionUpdate.question_text = data.question_text;
  }
  if (data.question_type) {
    questionUpdate.question_type = data.question_type;
  }

  if (Object.keys(questionUpdate).length > 0) {
    const { error } = await supabase
      .from("quiz_questions")
      .update(questionUpdate)
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

    const questionType = data.question_type ?? "single";
    const correctCount = data.options.filter((o) => o.is_correct).length;

    if (questionType === "single") {
      if (correctCount !== 1) {
        return { success: false, error: "Exactly one correct answer is required" };
      }
    } else {
      if (correctCount < 1) {
        return { success: false, error: "At least one correct answer is required" };
      }
      const incorrectCount = data.options.length - correctCount;
      if (incorrectCount < 1) {
        return { success: false, error: "At least one incorrect option is required" };
      }
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
