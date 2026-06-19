"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { sendCompletionEmails } from "@/lib/learning/completion-emails";
import type { Database } from "@/types/database.types";

/**
 * Ensure the current user has an enrolment row for a hub-sourced course.
 * Creates an in-progress enrolment on first access. Never downgrades a
 * completed enrolment.
 */
export async function ensureHubEnrolment(courseId: string): Promise<void> {
  const { supabase, user } = await getCurrentUser();

  if (!user) return;

  // Only hub-sourced courses self-enrol on access.
  const { data: course } = await supabase
    .from("courses")
    .select("id, source")
    .eq("id", courseId)
    .single();

  if (!course || course.source !== "hub") return;

  // If an enrolment already exists, never downgrade a completed one.
  const { data: existing } = await supabase
    .from("course_enrolments")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .single();

  if (existing) {
    // Enrolment already present (in_progress or completed) — leave it alone.
    return;
  }

  const { error } = await supabase
    .from("course_enrolments")
    .insert({
      user_id: user.id,
      course_id: courseId,
      status: "in_progress",
      progress_percent: 0,
    } as Database["public"]["Tables"]["course_enrolments"]["Insert"]);

  // Ignore unique-violation: a concurrent request created the row first.
  if (error && error.code !== "23505") {
    logger.error("Failed to ensure hub enrolment", { error });
    return;
  }

  revalidatePath(`/learning/courses/${courseId}`);
  revalidatePath("/learning");
}

/**
 * Mark a hub-sourced course as completed for the current user. The DB trigger
 * trg_auto_issue_certificate issues the certificate when status flips to
 * completed and courses.issue_certificate is true; the in-app notification
 * fires via its own trigger.
 */
export async function completeHubCourse(
  courseId: string,
  score?: number
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, source")
    .eq("id", courseId)
    .single();

  if (!course || course.source !== "hub") {
    return { success: false, error: "Course not found" };
  }

  // Clamp score to an integer in [0, 100] when supplied, otherwise null.
  const clampedScore =
    typeof score === "number" && Number.isFinite(score)
      ? Math.max(0, Math.min(100, Math.round(score)))
      : null;

  const { data: existing } = await supabase
    .from("course_enrolments")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .single();

  // Already completed: idempotent no-op. Don't re-stamp completed_at or re-send
  // the certificate email (sendCompletionEmails has no server-side dedup, so an
  // unconditional re-send would deliver a duplicate). The certificate trigger
  // also only issues on the false→true transition.
  if (existing && existing.status === "completed") {
    return { success: true, error: null };
  }

  if (existing) {
    const { error } = await supabase
      .from("course_enrolments")
      .update({
        status: "completed",
        progress_percent: 100,
        completed_at: new Date().toISOString(),
        score: clampedScore,
      } as Database["public"]["Tables"]["course_enrolments"]["Update"])
      .eq("user_id", user.id)
      .eq("course_id", courseId);

    if (error) {
      logger.error("Failed to complete hub course", { error });
      return { success: false, error: "Failed to complete course. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
    }
  } else {
    const { error } = await supabase
      .from("course_enrolments")
      .insert({
        user_id: user.id,
        course_id: courseId,
        status: "completed",
        progress_percent: 100,
        completed_at: new Date().toISOString(),
        score: clampedScore,
      } as Database["public"]["Tables"]["course_enrolments"]["Insert"]);

    if (error) {
      logger.error("Failed to complete hub course", { error });
      return { success: false, error: "Failed to complete course. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
    }
  }

  // Non-blocking: queue completion + certificate emails (same pattern as completeLesson).
  sendCompletionEmails(user.id, courseId);

  revalidatePath(`/learning/courses/${courseId}`);
  revalidatePath("/learning");
  return { success: true, error: null };
}
