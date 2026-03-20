"use server";

import { requireLDAdmin } from "@/lib/auth";
import { validateQuizOptions } from "@/lib/learning";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import type { SectionQuizQuestionType } from "@/types/database.types";

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

  const ALLOWED_FIELDS = [
    "course_id",
    "title",
    "description",
    "sort_order",
  ] as const;

  const sanitized: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in data) {
      sanitized[field] = data[field as keyof typeof data];
    }
  }

  const { data: section, error } = await supabase
    .from("course_sections")
    .insert(sanitized)
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
    is_active?: boolean;
  }
) {
  const { supabase } = await requireLDAdmin();

  const ALLOWED_FIELDS = [
    "title",
    "description",
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
  sectionOrders: { id: string; sort_order: number }[]
) {
  const { supabase } = await requireLDAdmin();

  const results = await Promise.all(
    sectionOrders.map(({ id, sort_order }) =>
      supabase.from("course_sections").update({ sort_order }).eq("id", id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    logger.error("Failed to reorder sections", { error: failed.error.message });
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

  const sanitized: Record<string, unknown> = {
    section_id: data.section_id,
  };

  if (data.title !== undefined) {
    sanitized.title = data.title;
  }
  if (data.passing_score !== undefined) {
    sanitized.passing_score = data.passing_score;
  }

  const { data: quiz, error } = await supabase
    .from("section_quizzes")
    .insert(sanitized)
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to create section quiz", { error });
    return { success: false, error: "Failed to create section quiz. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.", quizId: null };
  }

  revalidatePath(`/learning/admin/courses/${data.course_id}`);
  revalidatePath(`/learning/courses/${data.course_id}`);
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

  const ALLOWED_FIELDS = [
    "title",
    "passing_score",
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
    .from("section_quizzes")
    .update(sanitized)
    .eq("id", quizId);

  if (error) {
    logger.error("Failed to update section quiz", { error });
    return { success: false, error: "Failed to update section quiz. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
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
    return { success: false, error: "Failed to delete section quiz. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
  return { success: true, error: null };
}

// ===========================================
// SECTION QUIZ QUESTION CRUD
// ===========================================

export async function createSectionQuizQuestion(data: {
  quiz_id: string;
  course_id: string;
  question_text: string;
  question_type?: SectionQuizQuestionType;
  sort_order: number;
  options: { option_text: string; is_correct: boolean; sort_order: number }[];
}) {
  const { supabase } = await requireLDAdmin();

  const questionType = data.question_type ?? "single";

  const validationError = validateQuizOptions(data.options, questionType);
  if (validationError) {
    return { success: false, error: validationError, questionId: null };
  }

  // Insert question
  const { data: question, error: qError } = await supabase
    .from("section_quiz_questions")
    .insert({
      quiz_id: data.quiz_id,
      question_text: data.question_text,
      question_type: questionType,
      sort_order: data.sort_order,
    })
    .select("id")
    .single();

  if (qError) {
    logger.error("Failed to create section quiz question", { error: qError.message });
    return { success: false, error: "Failed to create section quiz question. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.", questionId: null };
  }

  // Insert options
  const options = data.options.map((opt, i) => ({
    question_id: question.id,
    option_text: opt.option_text,
    is_correct: opt.is_correct,
    sort_order: opt.sort_order ?? i,
  }));

  const { error: oError } = await supabase.from("section_quiz_options").insert(options);

  if (oError) {
    // Cleanup question if options failed
    await supabase.from("section_quiz_questions").delete().eq("id", question.id);
    logger.error("Failed to create section quiz options", { error: oError.message });
    return { success: false, error: "Failed to create section quiz options. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.", questionId: null };
  }

  revalidatePath(`/learning/admin/courses/${data.course_id}`);
  revalidatePath(`/learning/courses/${data.course_id}`);
  return { success: true, error: null, questionId: question.id };
}

export async function updateSectionQuizQuestion(
  questionId: string,
  courseId: string,
  data: {
    question_text?: string;
    question_type?: SectionQuizQuestionType;
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
      .from("section_quiz_questions")
      .update(questionUpdate)
      .eq("id", questionId);

    if (error) {
      logger.error("Failed to update section quiz question", { error });
      return { success: false, error: "Failed to update section quiz question. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
    }
  }

  if (data.options) {
    // Determine the effective question type — fetch from DB if not provided
    // to avoid incorrectly defaulting a "multi" question to "single" validation
    let questionType: SectionQuizQuestionType = data.question_type ?? "single";
    if (!data.question_type) {
      const { data: existingQuestion } = await supabase
        .from("section_quiz_questions")
        .select("question_type")
        .eq("id", questionId)
        .single();

      if (!existingQuestion) {
        return { success: false, error: "Question not found" };
      }
      questionType = (existingQuestion.question_type as SectionQuizQuestionType) ?? "single";
    }

    const validationError = validateQuizOptions(data.options, questionType);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Replace all options: delete existing, insert new set
    const { error: deleteError } = await supabase.from("section_quiz_options").delete().eq("question_id", questionId);
    if (deleteError) {
      logger.error("Failed to delete section quiz options", { error: deleteError.message });
      return { success: false, error: "Failed to update section quiz options. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
    }

    const newOptions = data.options.map((opt, i) => ({
      question_id: questionId,
      option_text: opt.option_text,
      is_correct: opt.is_correct,
      sort_order: opt.sort_order ?? i,
    }));

    const { error } = await supabase.from("section_quiz_options").insert(newOptions);
    if (error) {
      logger.error("Failed to insert section quiz options", { error });
      return { success: false, error: "Failed to update section quiz options. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
    }
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
  return { success: true, error: null };
}

export async function deleteSectionQuizQuestion(questionId: string, courseId: string) {
  const { supabase } = await requireLDAdmin();

  const { error } = await supabase
    .from("section_quiz_questions")
    .delete()
    .eq("id", questionId);

  if (error) {
    logger.error("Failed to delete section quiz question", { error });
    return { success: false, error: "Failed to delete section quiz question. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
  return { success: true, error: null };
}

export async function reorderSectionQuizQuestions(
  courseId: string,
  questionOrders: { id: string; sort_order: number }[]
) {
  const { supabase } = await requireLDAdmin();

  const results = await Promise.all(
    questionOrders.map(({ id, sort_order }) =>
      supabase.from("section_quiz_questions").update({ sort_order }).eq("id", id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    logger.error("Failed to reorder section quiz questions", { error: failed.error.message });
    return { success: false, error: "Failed to reorder section quiz questions. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
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

  const sanitized: Record<string, unknown> = {
    question_id: data.question_id,
    option_text: data.option_text,
    sort_order: data.sort_order,
  };

  if (data.is_correct !== undefined) {
    sanitized.is_correct = data.is_correct;
  }

  const { data: option, error } = await supabase
    .from("section_quiz_options")
    .insert(sanitized)
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to create section quiz option", { error });
    return { success: false, error: "Failed to create section quiz option. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.", optionId: null };
  }

  revalidatePath(`/learning/admin/courses/${data.course_id}`);
  revalidatePath(`/learning/courses/${data.course_id}`);
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

  const ALLOWED_FIELDS = [
    "option_text",
    "is_correct",
    "sort_order",
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
    .from("section_quiz_options")
    .update(sanitized)
    .eq("id", optionId);

  if (error) {
    logger.error("Failed to update section quiz option", { error });
    return { success: false, error: "Failed to update section quiz option. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
  return { success: true, error: null };
}

export async function deleteSectionQuizOption(optionId: string, courseId: string) {
  const { supabase } = await requireLDAdmin();

  const { error } = await supabase
    .from("section_quiz_options")
    .delete()
    .eq("id", optionId);

  if (error) {
    logger.error("Failed to delete section quiz option", { error });
    return { success: false, error: "Failed to delete section quiz option. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath(`/learning/admin/courses/${courseId}`);
  revalidatePath(`/learning/courses/${courseId}`);
  return { success: true, error: null };
}

