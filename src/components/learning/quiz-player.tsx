"use client";

import { useState, useTransition } from "react";
import { submitQuiz } from "@/app/(protected)/learning/courses/[id]/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  RefreshCcw,
  AlertCircle,
  Loader2,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuizQuestionWithOptions, QuizAttempt, QuestionType } from "@/types/database.types";

interface QuizPlayerProps {
  lessonId: string;
  courseId: string;
  questions: QuizQuestionWithOptions[];
  passingScore: number;
  previousAttempts: QuizAttempt[];
  isCompleted: boolean;
  isLastLesson?: boolean;
}

interface QuizResult {
  score: number;
  passed: boolean;
  correct_answers: number;
  total_questions: number;
  progress_percent: number;
}

export function QuizPlayer({
  lessonId,
  courseId,
  questions,
  passingScore,
  previousAttempts,
  isCompleted,
  isLastLesson = false,
}: QuizPlayerProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const lastAttempt = previousAttempts[0] ?? null;

  const allAnswered = questions.every((q) => {
    const answer = answers[q.id];
    const qType = (q.question_type ?? "single") as QuestionType;
    if (qType === "multi") {
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
      const response = await submitQuiz(lessonId, courseId, answers);
      if (!response.success) {
        setError(response.error ?? "Failed to submit quiz. Please try again.");
      } else if (response.result) {
        setResult(response.result);
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
            {lastAttempt && (
              <p className="text-sm text-muted-foreground">
                Your best score: {lastAttempt.score}%
              </p>
            )}
            {isLastLesson && (
              <p className="text-sm text-muted-foreground">
                All lessons in this course are complete.
              </p>
            )}
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
          Pass mark: <strong>{passingScore}%</strong>{" "}
          {isLastLesson ? "required to complete." : "required to continue."}
        </span>
      </div>

      {/* Questions */}
      <div className="space-y-8">
        {questions.map((q, idx) => {
          const qType = (q.question_type ?? "single") as QuestionType;
          const isMulti = qType === "multi";

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
                      ? Array.isArray(currentAnswer) && currentAnswer.includes(opt.id)
                      : currentAnswer === opt.id;
                    const showResult = !!result;

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
                          !showResult && isSelected &&
                            "border-primary bg-primary/5 text-primary",
                          !showResult && !isSelected &&
                            "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
                          showResult && isSelected &&
                            "border-muted-foreground/30 bg-muted/50",
                          (!!result || isPending) && "cursor-not-allowed opacity-80"
                        )}
                      >
                        <span className="text-sm">{opt.option_text}</span>
                        {isSelected && !showResult && (
                          isMulti ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : (
                            <div className="h-3 w-3 rounded-full bg-primary" />
                          )
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
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-6 py-3 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">
                  {isLastLesson
                    ? "Quiz Passed! You\u2019ve completed all lessons in this course."
                    : "Quiz Passed! You can proceed to the next lesson."}
                </span>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-6 py-3 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">
                    Score too low. You need {passingScore}% to pass.
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  className="mx-auto"
                >
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
