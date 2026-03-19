"use server";

import { requireLDAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

// ===========================================
// SECTION CRUD
// ===========================================

export async function createSection(data: {
  course_id: string;
  title: string;
  description?: string | null;
  sort_order: number;
}) {
  const { supabase } = await requireLDAdmin();

  const { data: section, error } = await supabase
    .from("course_sections")
    .insert({
      course_id: data.course_id,
      title: data.title,
      description: data.description ?? null,
      sort_order: data.sort_order,
    })
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to create section", { error });
    return { success: false, error: "Failed to create section. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.", sectionId: null };
  }

  revalidatePath(`/learning/admin/courses/${data.course_id}`);
  revalidatePath(`/learning/courses/${data.course_id}`);
  return { success: true, error: null, sectionId: section.id };
}

export async function updateSection(
  sectionId: string,
  courseId: string,
  data: {
    title?: string;
    description?: string | null;
    sort_order?: number;
    is_active?: boolean;
  }
) {
  const { supabase } = await requireLDAdmin();

  const ALLOWED_FIELDS = ["title", "description", "sort_order", "is_active"] as const;

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
    .from("course_sections")
    .update(sanitized)
    .eq("id", sectionId);

  if (error) {
    logger.error("Failed to update section", { error });
    return { success: false, error: "Failed to update section. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
  return { success: true, error: null };
}

export async function deleteSection(sectionId: string, courseId: string) {
  const { supabase } = await requireLDAdmin();

  // Check if section has lessons
  const { count } = await supabase
    .from("course_lessons")
    .select("id", { count: "exact", head: true })
    .eq("section_id", sectionId)
    .eq("is_active", true);

  if (count && count > 0) {
    return {
      success: false,
      error: `Cannot delete section with ${count} active lesson${count > 1 ? "s" : ""}. Remove or move lessons first.`,
    };
  }

  const { error } = await supabase
    .from("course_sections")
    .delete()
    .eq("id", sectionId);

  if (error) {
    logger.error("Failed to delete section", { error });
    return { success: false, error: "Failed to delete section. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
  return { success: true, error: null };
}

export async function reorderSections(
  courseId: string,
  sectionIds: string[]
) {
  const { supabase } = await requireLDAdmin();

  // Update sort_order for each section
  const updates = sectionIds.map((id, index) =>
    supabase
      .from("course_sections")
      .update({ sort_order: index })
      .eq("id", id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);

  if (failed?.error) {
    logger.error("Failed to reorder sections", { error: failed.error });
    return { success: false, error: "Failed to reorder sections. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
  return { success: true, error: null };
}

// ===========================================
// SECTION QUIZ CRUD
// ===========================================

export async function createSectionQuiz(data: {
  section_id: string;
  course_id: string;
  title?: string;
  passing_score?: number;
}) {
  const { supabase } = await requireLDAdmin();

  const { data: quiz, error } = await supabase
    .from("section_quizzes")
    .insert({
      section_id: data.section_id,
      title: data.title ?? "Section Quiz",
      passing_score: data.passing_score ?? 80,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "This section already has a quiz.", quizId: null };
    }
    logger.error("Failed to create section quiz", { error });
    return { success: false, error: "Failed to create quiz. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.", quizId: null };
  }

  revalidatePath(`/learning/admin/courses/${data.course_id}`);
  return { success: true, error: null, quizId: quiz.id };
}

export async function updateSectionQuiz(
  quizId: string,
  courseId: string,
  data: {
    title?: string;
    passing_score?: number;
    is_active?: boolean;
  }
) {
  const { supabase } = await requireLDAdmin();

  const ALLOWED_FIELDS = ["title", "passing_score", "is_active"] as const;

  const sanitized: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in data) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  const { error } = await supabase
    .from("section_quizzes")
    .update(sanitized)
    .eq("id", quizId);

  if (error) {
    logger.error("Failed to update section quiz", { error });
    return { success: false, error: "Failed to update quiz. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  return { success: true, error: null };
}

export async function deleteSectionQuiz(quizId: string, courseId: string) {
  const { supabase } = await requireLDAdmin();

  const { error } = await supabase
    .from("section_quizzes")
    .delete()
    .eq("id", quizId);

  if (error) {
    logger.error("Failed to delete section quiz", { error });
    return { success: false, error: "Failed to delete quiz. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  return { success: true, error: null };
}

// ===========================================
// SECTION QUIZ QUESTION CRUD
// ===========================================

export async function createSectionQuizQuestion(data: {
  quiz_id: string;
  course_id: string;
  question_text: string;
  question_type?: "single" | "multi";
  sort_order: number;
}) {
  const { supabase } = await requireLDAdmin();

  const { data: question, error } = await supabase
    .from("section_quiz_questions")
    .insert({
      quiz_id: data.quiz_id,
      question_text: data.question_text,
      question_type: data.question_type ?? "single",
      sort_order: data.sort_order,
    })
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to create quiz question", { error });
    return { success: false, error: "Failed to create question. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.", questionId: null };
  }

  revalidatePath(`/learning/admin/courses/${data.course_id}`);
  return { success: true, error: null, questionId: question.id };
}

export async function updateSectionQuizQuestion(
  questionId: string,
  courseId: string,
  data: {
    question_text?: string;
    question_type?: "single" | "multi";
    sort_order?: number;
  }
) {
  const { supabase } = await requireLDAdmin();

  const ALLOWED_FIELDS = ["question_text", "question_type", "sort_order"] as const;

  const sanitized: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in data) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  const { error } = await supabase
    .from("section_quiz_questions")
    .update(sanitized)
    .eq("id", questionId);

  if (error) {
    logger.error("Failed to update quiz question", { error });
    return { success: false, error: "Failed to update question. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  return { success: true, error: null };
}

export async function deleteSectionQuizQuestion(questionId: string, courseId: string) {
  const { supabase } = await requireLDAdmin();

  const { error } = await supabase
    .from("section_quiz_questions")
    .delete()
    .eq("id", questionId);

  if (error) {
    logger.error("Failed to delete quiz question", { error });
    return { success: false, error: "Failed to delete question. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  return { success: true, error: null };
}

// ===========================================
// SECTION QUIZ OPTION CRUD
// ===========================================

export async function createSectionQuizOption(data: {
  question_id: string;
  course_id: string;
  option_text: string;
  is_correct?: boolean;
  sort_order: number;
}) {
  const { supabase } = await requireLDAdmin();

  const { data: option, error } = await supabase
    .from("section_quiz_options")
    .insert({
      question_id: data.question_id,
      option_text: data.option_text,
      is_correct: data.is_correct ?? false,
      sort_order: data.sort_order,
    })
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to create quiz option", { error });
    return { success: false, error: "Failed to create option. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.", optionId: null };
  }

  revalidatePath(`/learning/admin/courses/${data.course_id}`);
  return { success: true, error: null, optionId: option.id };
}

export async function updateSectionQuizOption(
  optionId: string,
  courseId: string,
  data: {
    option_text?: string;
    is_correct?: boolean;
    sort_order?: number;
  }
) {
  const { supabase } = await requireLDAdmin();

  const ALLOWED_FIELDS = ["option_text", "is_correct", "sort_order"] as const;

  const sanitized: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in data) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  const { error } = await supabase
    .from("section_quiz_options")
    .update(sanitized)
    .eq("id", optionId);

  if (error) {
    logger.error("Failed to update quiz option", { error });
    return { success: false, error: "Failed to update option. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  return { success: true, error: null };
}

export async function deleteSectionQuizOption(optionId: string, courseId: string) {
  const { supabase } = await requireLDAdmin();

  const { error } = await supabase
    .from("section_quiz_options")
    .delete()
    .eq("id", optionId);

  if (error) {
    logger.error("Failed to delete quiz option", { error });
    return { success: false, error: "Failed to delete option. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  return { success: true, error: null };
}

export async function reorderSectionQuizQuestions(
  quizId: string,
  courseId: string,
  questionIds: string[]
) {
  const { supabase } = await requireLDAdmin();

  const updates = questionIds.map((id, index) =>
    supabase
      .from("section_quiz_questions")
      .update({ sort_order: index })
      .eq("id", id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);

  if (failed?.error) {
    logger.error("Failed to reorder quiz questions", { error: failed.error });
    return { success: false, error: "Failed to reorder questions. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  return { success: true, error: null };
}
