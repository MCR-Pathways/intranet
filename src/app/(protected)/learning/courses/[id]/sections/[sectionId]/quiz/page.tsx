import { getCurrentUser } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SectionQuizPlayer } from "@/components/learning/section-quiz-player";
import { getLockedSectionIds } from "@/lib/learning";

export default async function SectionQuizPage({
  params,
}: {
  params: Promise<{ id: string; sectionId: string }>;
}) {
  const { id: courseId, sectionId } = await params;
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Check enrolment — redirect to course page if not enrolled
  const { data: enrolment } = await supabase
    .from("course_enrolments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .single();

  if (!enrolment) {
    redirect(`/learning/courses/${courseId}`);
  }

  // Fetch the section and verify it belongs to the course
  const { data: section } = await supabase
    .from("course_sections")
    .select("id, title, course_id, sort_order")
    .eq("id", sectionId)
    .eq("course_id", courseId)
    .eq("is_active", true)
    .single();

  if (!section) {
    notFound();
  }

  // Fetch the section quiz for this section
  const { data: quiz } = await supabase
    .from("section_quizzes")
    .select("id, section_id, title, passing_score")
    .eq("section_id", sectionId)
    .eq("is_active", true)
    .single();

  if (!quiz) {
    notFound();
  }

  // Fetch quiz questions with options (strip is_correct for security)
  const { data: questionsData } = await supabase
    .from("section_quiz_questions")
    .select("id, quiz_id, question_text, question_type, sort_order")
    .eq("quiz_id", quiz.id)
    .order("sort_order");

  const questions = questionsData ?? [];

  // Fetch options for each question (strip is_correct to prevent cheating)
  const questionIds = questions.map((q) => q.id);
  let optionsData: { id: string; question_id: string; option_text: string; sort_order: number }[] = [];
  if (questionIds.length > 0) {
    const { data: opts } = await supabase
      .from("section_quiz_options")
      .select("id, question_id, option_text, sort_order")
      .in("question_id", questionIds)
      .order("sort_order");
    optionsData = opts ?? [];
  }

  // Group options by question_id for O(1) lookup
  const optionsByQuestion = new Map<string, { id: string; option_text: string }[]>();
  for (const o of optionsData) {
    const list = optionsByQuestion.get(o.question_id) ?? [];
    list.push({ id: o.id, option_text: o.option_text });
    optionsByQuestion.set(o.question_id, list);
  }

  // Assemble questions with options (is_correct NOT included — returned by server action after submission)
  const questionsWithOptions = questions.map((q) => ({
    id: q.id,
    question_text: q.question_text,
    question_type: q.question_type as "single" | "multi",
    options: optionsByQuestion.get(q.id) ?? [],
  }));

  // Fetch user's previous attempts (sorted newest first)
  const { data: attemptsData } = await supabase
    .from("section_quiz_attempts")
    .select("id, score, passed, attempted_at")
    .eq("user_id", user.id)
    .eq("quiz_id", quiz.id)
    .eq("section_id", sectionId)
    .order("attempted_at", { ascending: false });

  const previousAttempts = (attemptsData ?? []).map((a) => ({
    id: a.id,
    score: a.score,
    passed: a.passed,
    attempted_at: a.attempted_at,
  }));

  // Check if section is locked
  const { data: allSections } = await supabase
    .from("course_sections")
    .select("id, sort_order")
    .eq("course_id", courseId)
    .eq("is_active", true)
    .order("sort_order");

  const sections = allSections ?? [];
  const sectionIds = sections.map((s) => s.id);

  // Find all section quizzes for this course
  let sectionsWithQuizzes = new Set<string>();
  if (sectionIds.length > 0) {
    const { data: sectionQuizzes } = await supabase
      .from("section_quizzes")
      .select("id, section_id")
      .in("section_id", sectionIds)
      .eq("is_active", true);
    sectionsWithQuizzes = new Set((sectionQuizzes ?? []).map((q) => q.section_id));
  }

  // Find all passed quiz section IDs
  let passedQuizSectionIds = new Set<string>();
  if (sectionsWithQuizzes.size > 0) {
    const { data: passedAttempts } = await supabase
      .from("section_quiz_attempts")
      .select("section_id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .eq("passed", true);
    passedQuizSectionIds = new Set((passedAttempts ?? []).map((a) => a.section_id));
  }

  const lockedSectionIds = getLockedSectionIds(sections, passedQuizSectionIds, sectionsWithQuizzes);

  // If this section is locked, redirect to course page
  if (lockedSectionIds.has(sectionId)) {
    redirect(`/learning/courses/${courseId}`);
  }

  // Determine if already completed (any passed attempt = completed)
  const isCompleted = previousAttempts.some((a) => a.passed);

  // Fetch course title for breadcrumbs
  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .single();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        title={quiz.title || "Section Quiz"}
        subtitle={`Section: ${section.title}`}
        breadcrumbs={[
          { label: "Learning", href: "/learning" },
          { label: "Courses", href: "/learning/courses" },
          { label: course?.title ?? "Course", href: `/learning/courses/${courseId}` },
          { label: section.title },
          { label: "Quiz" },
        ]}
      />

      <SectionQuizPlayer
        quizId={quiz.id}
        sectionId={sectionId}
        courseId={courseId}
        questions={questionsWithOptions}
        passingScore={quiz.passing_score}
        previousAttempts={previousAttempts}
        isCompleted={isCompleted}
      />
    </div>
  );
}
