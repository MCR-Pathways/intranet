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

  // Use atomic RPC to insert completion and update progress in a single transaction
  const { data: progressPercent, error } = await supabase.rpc(
    "complete_lesson_and_update_progress",
    {
      p_user_id: user.id,
      p_lesson_id: lessonId,
      p_course_id: courseId,
    }
  );

  if (error) {
    return { success: false, error: error.message, progressPercent: null };
  }

  revalidatePath(`/learning/courses/${courseId}`);
  revalidatePath("/learning");
  revalidatePath("/learning/my-courses");
  return { success: true, error: null, progressPercent };
}
