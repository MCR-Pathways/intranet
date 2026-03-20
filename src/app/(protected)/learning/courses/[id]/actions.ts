"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

export async function enrollInCourse(courseId: string) {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase.from("course_enrolments").insert({
    user_id: user.id,
    course_id: courseId,
    status: "enrolled",
    progress_percent: 0,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Already enrolled in this course" };
    }
    logger.error("Failed to enrol in course", { error });
    return { success: false, error: "Failed to enrol in course. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/courses/${courseId}`);
  revalidatePath("/learning");
  revalidatePath("/learning/my-courses");
  return { success: true, error: null };
}

export async function completeLesson(lessonId: string, courseId: string) {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated", progressPercent: null };
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
    logger.error("Failed to complete lesson", { error });
    return { success: false, error: "Failed to complete lesson. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.", progressPercent: null };
  }

  revalidatePath(`/learning/courses/${courseId}`);
  revalidatePath("/learning");
  revalidatePath("/learning/my-courses");
  return { success: true, error: null, progressPercent };
}

export async function submitQuiz(
  lessonId: string,
  courseId: string,
  answers: Record<string, string | string[]>
) {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated", result: null };
  }

  const { data: result, error } = await supabase.rpc("submit_quiz_attempt", {
    p_user_id: user.id,
    p_lesson_id: lessonId,
    p_course_id: courseId,
    p_answers: answers,
  });

  if (error) {
    logger.error("Failed to submit quiz", { error });
    return { success: false, error: "Failed to submit quiz. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.", result: null };
  }

  revalidatePath(`/learning/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}/lessons/${lessonId}`);
  revalidatePath("/learning");
  revalidatePath("/learning/my-courses");
  return { success: true, error: null, result: result as {
    score: number;
    passed: boolean;
    correct_answers: number;
    total_questions: number;
    progress_percent: number;
  } };
}

export async function submitSectionQuiz(
  quizId: string,
  sectionId: string,
  courseId: string,
  answers: Record<string, string | string[]>
) {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated", result: null };
  }

  const { data: result, error } = await supabase.rpc("submit_section_quiz_attempt", {
    p_user_id: user.id,
    p_quiz_id: quizId,
    p_section_id: sectionId,
    p_course_id: courseId,
    p_answers: answers,
  });

  if (error) {
    logger.error("Failed to submit section quiz", { error });
    return { success: false, error: "Failed to submit quiz. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.", result: null };
  }

  revalidatePath(`/learning/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}/sections/${sectionId}/quiz`);
  revalidatePath("/learning");
  revalidatePath("/learning/my-courses");
  return { success: true, error: null, result: result as {
    score: number;
    passed: boolean;
    correct_answers: number;
    total_questions: number;
    passing_score: number;
  } };
}
