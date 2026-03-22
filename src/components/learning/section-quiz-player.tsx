"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitSectionQuiz } from "@/app/(protected)/learning/courses/[id]/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  RefreshCcw,
  AlertCircle,
  Loader2,
  Trophy,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuizQuestion {
  id: string;
  question_text: string;
  question_type: "single" | "multi";
  options: {
    id: string;
    option_text: string;
    is_correct?: boolean;
  }[];
}

interface QuizAttempt {
  id: string;
  score: number;
  passed: boolean;
  attempted_at: string;
}

interface SectionQuizPlayerProps {
  quizId: string;
  sectionId: string;
  courseId: string;
  questions: QuizQuestion[];
  passingScore: number;
  previousAttempts: QuizAttempt[];
  isCompleted: boolean;
}

interface QuizResult {
  score: number;
  passed: boolean;
  correct_answers: number;
  total_questions: number;
  passing_score: number;
}

/**
 * Quiz player for section-level quizzes. Allows learners to answer
 * single-choice and multi-choice questions, submit for grading,
 * review correct/incorrect answers, and retry on failure (unlimited retries).
 */
export function SectionQuizPlayer({
  quizId,
  sectionId,
  courseId,
  questions,
  passingScore,
  previousAttempts,
  isCompleted,
}: SectionQuizPlayerProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const bestAttempt = previousAttempts.reduce<QuizAttempt | null>(
    (best, attempt) => {
      if (!best || attempt.score > best.score) return attempt;
      return best;
    },
    null
  );

  const allAnswered = questions.every((q) => {
    const answer = answers[q.id];
    if (q.question_type === "multi") {
      return Array.isArray(answer) && answer.length > 0;
    }
    return typeof answer === "string" && answer.length > 0;
  });

  function handleSelectSingle(questionId: string, optionId: string) {
    if (result) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  function handleToggleMulti(questionId: string, optionId: string) {
    if (result) return;
    setAnswers((prev) => {
      const current = prev[questionId];
      const arr = Array.isArray(current) ? [...current] : [];
      const idx = arr.indexOf(optionId);
      if (idx >= 0) {
        arr.splice(idx, 1);
      } else {
        arr.push(optionId);
      }
      return { ...prev, [questionId]: arr };
    });
  }

  function handleSubmit() {
    if (!allAnswered) return;
    startTransition(async () => {
      setError(null);
      const response = await submitSectionQuiz(quizId, sectionId, courseId, answers);
      if (!response.success) {
        setError(response.error ?? "Failed to submit quiz. Please try again.");
        toast.error(response.error ?? "Failed to submit quiz. Please try again.");
      } else if (response.result) {
        setResult(response.result);
        if (response.result.passed) {
          toast.success("Quiz passed!");
        }
      }
    });
  }

  function handleRetry() {
    setAnswers({});
    setResult(null);
    setError(null);
  }

  // Already completed state
  if (isCompleted && !result) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-6 py-3 text-green-700">
              <Trophy className="h-5 w-5" />
              <span className="font-medium">Quiz Completed</span>
            </div>
            {bestAttempt && (
              <p className="text-sm text-muted-foreground">
                Your best score: {bestAttempt.score}%
              </p>
            )}
            <Button asChild variant="outline">
              <Link href={`/learning/courses/${courseId}`}>
                <ArrowRight className="h-4 w-4 mr-2" />
                Continue to next section
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quiz header */}
      <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 text-primary" />
        <span>
          Pass mark: <strong>{passingScore}%</strong> required to unlock the
          next section.
        </span>
      </div>

      {/* Previous attempts summary */}
      {previousAttempts.length > 0 && !result && (
        <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
          <p>
            Previous attempts: {previousAttempts.length} &middot; Best score:{" "}
            <strong>{bestAttempt?.score ?? 0}%</strong>
          </p>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-8">
        {questions.map((q, idx) => {
          const isMulti = q.question_type === "multi";
          const showResult = !!result;

          return (
            <Card key={q.id}>
              <CardContent className="pt-6">
                <h3 className="mb-1 text-lg font-semibold">
                  {idx + 1}. {q.question_text}
                </h3>
                {isMulti && (
                  <p className="mb-4 text-sm text-muted-foreground">
                    Select all that apply
                  </p>
                )}
                {!isMulti && <div className="mb-4" />}
                <div className="space-y-3">
                  {q.options.map((opt) => {
                    const currentAnswer = answers[q.id];
                    const isSelected = isMulti
                      ? Array.isArray(currentAnswer) &&
                        currentAnswer.includes(opt.id)
                      : currentAnswer === opt.id;
                    const isCorrect = opt.is_correct === true;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!!result || isPending}
                        onClick={() =>
                          isMulti
                            ? handleToggleMulti(q.id, opt.id)
                            : handleSelectSingle(q.id, opt.id)
                        }
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border-2 p-4 text-left transition-all",
                          // Before submission
                          !showResult &&
                            isSelected &&
                            "border-primary bg-primary/5 text-primary",
                          !showResult &&
                            !isSelected &&
                            "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
                          // After submission: correct answer
                          showResult &&
                            isCorrect &&
                            "border-green-500 bg-green-50 text-green-800",
                          // After submission: wrong selection
                          showResult &&
                            isSelected &&
                            !isCorrect &&
                            "border-red-400 bg-red-50 text-red-800",
                          // After submission: unselected, not correct
                          showResult &&
                            !isSelected &&
                            !isCorrect &&
                            "border-border opacity-60",
                          (!!result || isPending) && "cursor-not-allowed"
                        )}
                      >
                        <span className="text-sm">{opt.option_text}</span>
                        {/* Before submission: selection indicator */}
                        {isSelected &&
                          !showResult &&
                          (isMulti ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : (
                            <div className="h-3 w-3 rounded-full bg-primary" />
                          ))}
                        {/* After submission: correct/incorrect icons */}
                        {showResult && isCorrect && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                        )}
                        {showResult && isSelected && !isCorrect && (
                          <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Submit / Result area */}
      <div className="border-t border-border pt-6">
        {!result ? (
          <Button
            onClick={handleSubmit}
            disabled={!allAnswered || isPending}
            className="w-full md:w-auto"
            size="lg"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Quiz"
            )}
          </Button>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {/* Score display */}
            <div className="text-center">
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Your Score
              </p>
              <p
                className={cn(
                  "text-4xl font-bold",
                  result.passed ? "text-green-600" : "text-destructive"
                )}
              >
                {result.score}%
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.correct_answers} of {result.total_questions} correct
              </p>
            </div>

            {/* Pass / Fail feedback */}
            {result.passed ? (
              <div className="space-y-4 text-center">
                <div className="flex items-center gap-2 rounded-lg bg-green-50 px-6 py-3 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">
                    Quiz Passed! You can continue to the next section.
                  </span>
                </div>
                <Button asChild>
                  <Link href={`/learning/courses/${courseId}`}>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Continue to next section
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-6 py-3 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">
                    Score too low. You need {passingScore}% to pass.
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Review the correct answers above, then try again.
                </p>
                <Button variant="outline" onClick={handleRetry} className="mx-auto">
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Retry Quiz
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
