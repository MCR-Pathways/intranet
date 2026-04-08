"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { sendAndLogEmail } from "@/lib/email-queue";
import { buildCertificateEarnedEmail, buildCourseCompletedEmail } from "@/lib/email";
import { createServiceClient } from "@/lib/supabase/service";

/** Send course completion + certificate emails (non-blocking). */
async function sendCompletionEmails(userId: string, courseId: string) {
  try {
    const service = createServiceClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.mcrpathways.org";

    // Fetch user profile and course title
    const [{ data: profile }, { data: course }] = await Promise.all([
      service.from("profiles").select("id, full_name, email").eq("id", userId).single(),
      service.from("courses").select("title").eq("id", courseId).single(),
    ]);

    if (!profile || !course) return;

    // Check if a certificate was generated (by DB trigger)
    const { data: cert } = await service
      .from("certificates")
      .select("certificate_number")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .single();

    if (cert) {
      const { subject, html } = buildCertificateEarnedEmail(
        profile.full_name,
        course.title,
        cert.certificate_number,
        `${appUrl}/api/certificate/${userId}`
      );

      await sendAndLogEmail({
        userId: profile.id,
        email: profile.email,
        emailType: "certificate_earned",
        subject,
        bodyHtml: html,
        entityId: courseId,
        entityType: "course",
      });
    } else {
      // No certificate — send a simpler completion email
      const { subject, html } = buildCourseCompletedEmail(
        profile.full_name,
        course.title,
        `${appUrl}/learning/courses/${courseId}`
      );

      await sendAndLogEmail({
        userId: profile.id,
        email: profile.email,
        emailType: "course_completed",
        subject,
        bodyHtml: html,
        entityId: courseId,
        entityType: "course",
      });
    }
  } catch (err) {
    logger.error("Failed to queue completion emails", { error: err, userId, courseId });
  }
}

export async function enrollInCourse(courseId: string) {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated", firstLessonId: null };
  }

  const { error } = await supabase.from("course_enrolments").insert({
    user_id: user.id,
    course_id: courseId,
    status: "enrolled",
    progress_percent: 0,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Already enrolled in this course", firstLessonId: null };
    }
    logger.error("Failed to enrol in course", { error });
    return { success: false, error: "Failed to enrol in course. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.", firstLessonId: null };
  }

  // Fetch first active lesson for "Enrol and Start" navigation
  const { data: firstLesson } = await supabase
    .from("course_lessons")
    .select("id")
    .eq("course_id", courseId)
    .eq("is_active", true)
    .order("sort_order")
    .limit(1)
    .single();

  revalidatePath(`/learning/courses/${courseId}`);
  revalidatePath("/learning");
  return { success: true, error: null, firstLessonId: firstLesson?.id ?? null };
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

  // Queue completion emails if course is now 100% complete
  if (progressPercent === 100) {
    sendCompletionEmails(user.id, courseId);
  }

  revalidatePath(`/learning/courses/${courseId}`);
  revalidatePath("/learning");
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
    return { success: false, error: "Not authenticated", result: null, correctOptionMap: null };
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
    return { success: false, error: "Failed to submit quiz. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.", result: null, correctOptionMap: null };
  }

  // After submission, fetch correct answers for review display.
  // Security: is_correct is only returned AFTER submission, never on page load.
  const { data: quizQuestions } = await supabase
    .from("section_quiz_questions")
    .select("id")
    .eq("quiz_id", quizId);

  const questionIds = (quizQuestions ?? []).map((q) => q.id);
  const correctOptionMap: Record<string, string[]> = {};

  if (questionIds.length > 0) {
    const { data: correctOptions } = await supabase
      .from("section_quiz_options")
      .select("id, question_id")
      .in("question_id", questionIds)
      .eq("is_correct", true);

    for (const opt of correctOptions ?? []) {
      const list = correctOptionMap[opt.question_id] ?? [];
      list.push(opt.id);
      correctOptionMap[opt.question_id] = list;
    }
  }

  // Check if quiz completion triggered course completion
  const { data: enrolment } = await supabase
    .from("course_enrolments")
    .select("status")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .single();

  if (enrolment?.status === "completed") {
    sendCompletionEmails(user.id, courseId);
  }

  revalidatePath(`/learning/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}/sections/${sectionId}/quiz`);
  revalidatePath("/learning");
  return { success: true, error: null, result: result as {
    score: number;
    passed: boolean;
    correct_answers: number;
    total_questions: number;
    passing_score: number;
  }, correctOptionMap };
}
