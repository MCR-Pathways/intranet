import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  // Verify enrolment
  const { data: enrolment } = await supabase
    .from("course_enrolments")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .single();

  if (!enrolment) {
    redirect(`/learning/courses/${courseId}`);
  }

  // Fetch section + quiz data in parallel
  const [
    { data: section },
    { data: quiz },
    { data: allSections },
    { data: allAttempts },
  ] = await Promise.all([
    supabase
      .from("course_sections")
      .select("id, title, sort_order")
      .eq("id", sectionId)
      .eq("course_id", courseId)
      .eq("is_active", true)
      .single(),
    supabase
      .from("section_quizzes")
      .select("id, title, passing_score, is_active")
      .eq("section_id", sectionId)
      .eq("is_active", true)
      .single(),
    supabase
      .from("course_sections")
      .select("id, sort_order")
      .eq("course_id", courseId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("section_quiz_attempts")
      .select("quiz_id, passed")
      .eq("user_id", user.id),
  ]);

  if (!section || !quiz) {
    redirect(`/learning/courses/${courseId}`);
  }

  // Check if this section is locked
  // Get all quizzes to determine locking
  const { data: allQuizzes } = await supabase
    .from("section_quizzes")
    .select("id, section_id")
    .eq("is_active", true)
    .in("section_id", (allSections ?? []).map((s) => s.id));

  // Build set of section IDs that have quizzes
  const sectionsWithQuizzes = new Set(
    (allQuizzes ?? []).map((q) => q.section_id)
  );

  // Build set of section IDs where the user has passed the quiz
  const quizIdToSectionId = new Map(
    (allQuizzes ?? []).map((q) => [q.id, q.section_id])
  );
  const passedQuizSectionIds = new Set(
    (allAttempts ?? [])
      .filter((a) => a.passed)
      .map((a) => quizIdToSectionId.get(a.quiz_id))
      .filter((id): id is string => !!id)
  );

  const lockedSectionIds = getLockedSectionIds(
    (allSections ?? []).map((s) => ({ id: s.id, sort_order: s.sort_order })),
    passedQuizSectionIds,
    sectionsWithQuizzes
  );

  if (lockedSectionIds.has(sectionId)) {
    redirect(`/learning/courses/${courseId}`);
  }

  // Fetch questions (WITHOUT is_correct — security: never expose to client)
  const { data: questions } = await supabase
    .from("section_quiz_questions")
    .select("id, question_text, question_type, sort_order")
    .eq("quiz_id", quiz.id)
    .order("sort_order");

  // Fetch options (WITHOUT is_correct)
  const questionIds = (questions ?? []).map((q) => q.id);
  let optionsByQuestion: Record<string, { id: string; option_text: string }[]> = {};

  if (questionIds.length > 0) {
    const { data: options } = await supabase
      .from("section_quiz_options")
      .select("id, question_id, option_text, sort_order")
      .in("question_id", questionIds)
      .order("sort_order");

    for (const opt of options ?? []) {
      const list = optionsByQuestion[opt.question_id] ?? [];
      list.push({ id: opt.id, option_text: opt.option_text });
      optionsByQuestion[opt.question_id] = list;
    }
  }

  const formattedQuestions = (questions ?? []).map((q) => ({
    id: q.id,
    question_text: q.question_text,
    question_type: q.question_type as "single" | "multi",
    options: optionsByQuestion[q.id] ?? [],
  }));

  // Fetch previous attempts for this quiz
  const { data: previousAttempts } = await supabase
    .from("section_quiz_attempts")
    .select("id, score, passed, attempted_at")
    .eq("user_id", user.id)
    .eq("quiz_id", quiz.id)
    .order("attempted_at", { ascending: false });

  const isCompleted = (previousAttempts ?? []).some((a) => a.passed);

  // Fetch course title for breadcrumb
  const { data: course } = await supabase
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .single();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/learning/courses/${courseId}`}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {course?.title ?? "Course"}
        </Link>
      </Button>

      {/* Quiz title */}
      <div>
        <p className="text-sm text-muted-foreground">
          Section {section.sort_order + 1}: {section.title}
        </p>
        <h1 className="text-2xl font-bold">{quiz.title}</h1>
      </div>

      {/* Quiz player */}
      <SectionQuizPlayer
        quizId={quiz.id}
        sectionId={sectionId}
        courseId={courseId}
        questions={formattedQuestions}
        passingScore={quiz.passing_score}
        previousAttempts={previousAttempts ?? []}
        isCompleted={isCompleted}
      />
    </div>
  );
}
