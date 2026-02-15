"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function enrollInCourse(courseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase.from("course_enrollments").insert({
    user_id: user.id,
    course_id: courseId,
    status: "enrolled",
    progress_percent: 0,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Already enrolled in this course" };
    }
    return { success: false, error: error.message };
  }

  revalidatePath(`/learning/courses/${courseId}`);
  revalidatePath("/learning");
  revalidatePath("/learning/my-courses");
  return { success: true, error: null };
}

export async function completeLesson(lessonId: string, courseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Insert lesson completion (ignore duplicate)
  const { error } = await supabase.from("lesson_completions").insert({
    user_id: user.id,
    lesson_id: lessonId,
  });

  if (error && error.code !== "23505") {
    return { success: false, error: error.message };
  }

  // Get total active lessons for this course
  const { data: totalLessons } = await supabase
    .from("course_lessons")
    .select("id")
    .eq("course_id", courseId)
    .eq("is_active", true);

  // Get user's completions for this course's lessons
  const lessonIds = totalLessons?.map((l) => l.id) ?? [];

  let completedCount = 0;
  if (lessonIds.length > 0) {
    const { data: completedLessons } = await supabase
      .from("lesson_completions")
      .select("id, lesson_id")
      .eq("user_id", user.id)
      .in("lesson_id", lessonIds);

    completedCount = completedLessons?.length ?? 0;
  }

  const totalCount = lessonIds.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isCompleted = progressPercent === 100;
  const now = new Date().toISOString();

  // Update enrollment progress
  const updateData: Record<string, unknown> = {
    progress_percent: progressPercent,
    status: isCompleted
      ? "completed"
      : progressPercent > 0
        ? "in_progress"
        : "enrolled",
  };

  if (isCompleted) {
    updateData.completed_at = now;
  }

  // Set started_at only if not already set
  const { data: currentEnrollment } = await supabase
    .from("course_enrollments")
    .select("started_at")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .single();

  if (currentEnrollment && !currentEnrollment.started_at) {
    updateData.started_at = now;
  }

  await supabase
    .from("course_enrollments")
    .update(updateData)
    .eq("user_id", user.id)
    .eq("course_id", courseId);

  revalidatePath(`/learning/courses/${courseId}`);
  revalidatePath("/learning");
  revalidatePath("/learning/my-courses");
  return { success: true, error: null, progressPercent };
}
