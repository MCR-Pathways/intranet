"use client";

import { useState, useTransition } from "react";
import {
  createSectionQuiz,
  updateSectionQuiz,
  deleteSectionQuiz,
  createSectionQuizQuestion,
  updateSectionQuizQuestion,
  deleteSectionQuizQuestion,
} from "@/app/(protected)/learning/admin/courses/section-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Trash2,
  Loader2,
  HelpCircle,
  CheckCircle2,
  Circle,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  SectionQuiz,
  SectionQuizQuestionWithOptions,
  SectionQuizQuestionType,
} from "@/types/database.types";

interface SectionQuizEditorProps {
  sectionId: string;
  courseId: string;
  quiz: (SectionQuiz & { questions: SectionQuizQuestionWithOptions[] }) | null;
}

interface OptionInput {
  option_text: string;
  is_correct: boolean;
  sort_order: number;
}

export function SectionQuizEditor({
  sectionId,
  courseId,
  quiz,
}: SectionQuizEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Quiz settings state
  const [settingsTitle, setSettingsTitle] = useState(quiz?.title ?? "Section Quiz");
  const [settingsPassingScore, setSettingsPassingScore] = useState(
    quiz?.passing_score ?? 80
  );
  const [settingsActive, setSettingsActive] = useState(quiz?.is_active ?? true);

  // New question form state
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionType, setNewQuestionType] =
    useState<SectionQuizQuestionType>("single");
  const [newOptions, setNewOptions] = useState<OptionInput[]>([
    { option_text: "", is_correct: true, sort_order: 0 },
    { option_text: "", is_correct: false, sort_order: 1 },
  ]);

  // Edit question form state
  const [editQuestionText, setEditQuestionText] = useState("");
  const [editQuestionType, setEditQuestionType] =
    useState<SectionQuizQuestionType>("single");
  const [editOptions, setEditOptions] = useState<OptionInput[]>([]);

  const questions = quiz?.questions ?? [];

  // -----------------------------------------------
  // Quiz lifecycle helpers
  // -----------------------------------------------

  function handleCreateQuiz() {
    startTransition(async () => {
      setError(null);
      const result = await createSectionQuiz({
        section_id: sectionId,
        course_id: courseId,
        title: "Section Quiz",
        passing_score: 80,
      });
      if (!result.success) {
        setError(result.error ?? "Failed to create quiz");
        toast.error(result.error ?? "Failed to create quiz");
      } else {
        toast.success("Section quiz created");
      }
    });
  }

  function handleSaveSettings() {
    if (!quiz) return;
    if (!settingsTitle.trim()) {
      setError("Quiz title is required");
      return;
    }
    if (settingsPassingScore < 0 || settingsPassingScore > 100) {
      setError("Passing score must be between 0 and 100");
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await updateSectionQuiz(quiz.id, courseId, {
        title: settingsTitle.trim(),
        passing_score: settingsPassingScore,
        is_active: settingsActive,
      });
      if (!result.success) {
        setError(result.error ?? "Failed to update quiz settings");
        toast.error(result.error ?? "Failed to update quiz settings");
      } else {
        toast.success("Quiz settings saved");
      }
    });
  }

  function handleDeleteQuiz() {
    if (!quiz) return;
    startTransition(async () => {
      setError(null);
      const result = await deleteSectionQuiz(quiz.id, courseId);
      if (!result.success) {
        setError(result.error ?? "Failed to delete quiz");
        toast.error(result.error ?? "Failed to delete quiz");
      } else {
        toast.success("Section quiz deleted");
      }
    });
  }

  // -----------------------------------------------
  // Question form helpers
  // -----------------------------------------------

  function resetNewForm() {
    setNewQuestionText("");
    setNewQuestionType("single");
    setNewOptions([
      { option_text: "", is_correct: true, sort_order: 0 },
      { option_text: "", is_correct: false, sort_order: 1 },
    ]);
    setIsAdding(false);
    setError(null);
  }

  function startEditing(q: SectionQuizQuestionWithOptions) {
    setEditingId(q.id);
    setEditQuestionText(q.question_text);
    setEditQuestionType(
      (q.question_type ?? "single") as SectionQuizQuestionType
    );
    setEditOptions(
      q.options.map((o) => ({
        option_text: o.option_text,
        is_correct: o.is_correct,
        sort_order: o.sort_order,
      }))
    );
    setError(null);
  }

  function handleAddOption(
    opts: OptionInput[],
    setOpts: (o: OptionInput[]) => void
  ) {
    setOpts([
      ...opts,
      { option_text: "", is_correct: false, sort_order: opts.length },
    ]);
  }

  function handleRemoveOption(
    opts: OptionInput[],
    setOpts: (o: OptionInput[]) => void,
    index: number,
    questionType: SectionQuizQuestionType
  ) {
    if (opts.length <= 2) return;
    const updated = opts.filter((_, i) => i !== index);
    // If we removed all correct answers, make the first one correct
    if (!updated.some((o) => o.is_correct)) {
      updated[0].is_correct = true;
    }
    // For single-answer, ensure only one correct
    if (questionType === "single") {
      const correctIdx = updated.findIndex((o) => o.is_correct);
      updated.forEach((o, i) => {
        o.is_correct = i === correctIdx;
      });
    }
    setOpts(updated.map((o, i) => ({ ...o, sort_order: i })));
  }

  function handleSetCorrectSingle(
    opts: OptionInput[],
    setOpts: (o: OptionInput[]) => void,
    index: number
  ) {
    setOpts(opts.map((o, i) => ({ ...o, is_correct: i === index })));
  }

  function handleToggleCorrectMulti(
    opts: OptionInput[],
    setOpts: (o: OptionInput[]) => void,
    index: number
  ) {
    setOpts(
      opts.map((o, i) => (i === index ? { ...o, is_correct: !o.is_correct } : o))
    );
  }

  function handleQuestionTypeChange(
    newType: SectionQuizQuestionType,
    opts: OptionInput[],
    setOpts: (o: OptionInput[]) => void,
    setType: (t: SectionQuizQuestionType) => void
  ) {
    setType(newType);
    if (newType === "single") {
      // Switching to single: keep only the first correct answer
      const firstCorrectIdx = opts.findIndex((o) => o.is_correct);
      const idx = firstCorrectIdx >= 0 ? firstCorrectIdx : 0;
      setOpts(opts.map((o, i) => ({ ...o, is_correct: i === idx })));
    }
    // Switching to multi: existing correct answers stay as-is
  }

  // -----------------------------------------------
  // Save / delete question handlers
  // -----------------------------------------------

  function handleSaveNew() {
    if (!quiz) return;
    if (!newQuestionText.trim()) {
      setError("Question text is required");
      return;
    }
    if (newOptions.some((o) => !o.option_text.trim())) {
      setError("All options must have text");
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await createSectionQuizQuestion({
        quiz_id: quiz.id,
        course_id: courseId,
        question_text: newQuestionText.trim(),
        question_type: newQuestionType,
        sort_order: questions.length,
        options: newOptions.map((o) => ({
          option_text: o.option_text.trim(),
          is_correct: o.is_correct,
          sort_order: o.sort_order,
        })),
      });
      if (!result.success) {
        setError(result.error ?? "Failed to create question");
        toast.error(result.error ?? "Failed to create question");
      } else {
        toast.success("Question saved");
        resetNewForm();
      }
    });
  }

  function handleSaveEdit() {
    if (!editingId) return;
    if (!editQuestionText.trim()) {
      setError("Question text is required");
      return;
    }
    if (editOptions.some((o) => !o.option_text.trim())) {
      setError("All options must have text");
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await updateSectionQuizQuestion(editingId, courseId, {
        question_text: editQuestionText.trim(),
        question_type: editQuestionType,
        options: editOptions.map((o) => ({
          option_text: o.option_text.trim(),
          is_correct: o.is_correct,
          sort_order: o.sort_order,
        })),
      });
      if (!result.success) {
        setError(result.error ?? "Failed to update question");
        toast.error(result.error ?? "Failed to update question");
      } else {
        toast.success("Question saved");
        setEditingId(null);
        setError(null);
      }
    });
  }

  function handleDeleteQuestion(questionId: string) {
    startTransition(async () => {
      setError(null);
      const result = await deleteSectionQuizQuestion(questionId, courseId);
      if (!result.success) {
        setError(result.error ?? "Failed to delete question");
        toast.error(result.error ?? "Failed to delete question");
      } else {
        toast.success("Question deleted");
      }
    });
  }

  // -----------------------------------------------
  // Render helpers
  // -----------------------------------------------

  function renderQuestionTypeToggle(
    questionType: SectionQuizQuestionType,
    opts: OptionInput[],
    setOpts: (o: OptionInput[]) => void,
    setType: (t: SectionQuizQuestionType) => void
  ) {
    return (
      <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
        <button
          type="button"
          onClick={() =>
            handleQuestionTypeChange("single", opts, setOpts, setType)
          }
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            questionType === "single"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Circle className="h-3 w-3" />
          Single Answer
        </button>
        <button
          type="button"
          onClick={() =>
            handleQuestionTypeChange("multi", opts, setOpts, setType)
          }
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            questionType === "multi"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CheckSquare className="h-3 w-3" />
          Select All That Apply
        </button>
      </div>
    );
  }

  function renderOptionEditor(
    opts: OptionInput[],
    setOpts: (o: OptionInput[]) => void,
    questionType: SectionQuizQuestionType
  ) {
    const isSingle = questionType === "single";
    return (
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">
          {isSingle
            ? "Options (click circle to mark correct)"
            : "Options (click checkboxes to mark correct — select all that apply)"}
        </Label>
        {opts.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                isSingle
                  ? handleSetCorrectSingle(opts, setOpts, idx)
                  : handleToggleCorrectMulti(opts, setOpts, idx)
              }
              className="shrink-0"
              title={
                opt.is_correct
                  ? "Correct answer"
                  : isSingle
                    ? "Mark as correct"
                    : "Toggle correct"
              }
            >
              {isSingle ? (
                opt.is_correct ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                )
              ) : opt.is_correct ? (
                <CheckSquare className="h-5 w-5 text-green-600" />
              ) : (
                <Square className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              )}
            </button>
            <Input
              value={opt.option_text}
              onChange={(e) => {
                const updated = [...opts];
                updated[idx] = { ...updated[idx], option_text: e.target.value };
                setOpts(updated);
              }}
              placeholder={`Option ${idx + 1}`}
              className="flex-1"
            />
            {opts.length > 2 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  handleRemoveOption(opts, setOpts, idx, questionType)
                }
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        {opts.length < 6 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAddOption(opts, setOpts)}
            className="text-xs"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add Option
          </Button>
        )}
      </div>
    );
  }

  // -----------------------------------------------
  // Empty state — no quiz yet
  // -----------------------------------------------

  if (!quiz) {
    return (
      <div className="space-y-3">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-6 text-center">
          <HelpCircle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No section quiz. Add one to gate progress to the next section.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateQuiz}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1 h-4 w-4" />
            )}
            Add Section Quiz
          </Button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------
  // Main render — quiz exists
  // -----------------------------------------------

  return (
    <div className="space-y-4">
      {/* Error display */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Quiz settings */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <HelpCircle className="h-4 w-4" />
            Quiz Settings
          </h4>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Section Quiz</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this quiz, all its questions, and
                  all learner attempts. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </AlertDialogClose>
                <AlertDialogClose asChild>
                  <Button variant="destructive" onClick={handleDeleteQuiz}>
                    Delete Quiz
                  </Button>
                </AlertDialogClose>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="quiz-title" className="text-xs">
              Title
            </Label>
            <Input
              id="quiz-title"
              value={settingsTitle}
              onChange={(e) => setSettingsTitle(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="quiz-passing-score" className="text-xs">
              Passing Score (%)
            </Label>
            <Input
              id="quiz-passing-score"
              type="number"
              min={0}
              max={100}
              value={settingsPassingScore}
              onChange={(e) =>
                setSettingsPassingScore(Number(e.target.value))
              }
              className="mt-1"
            />
          </div>
          <div className="flex flex-col">
            <Label className="text-xs">Active</Label>
            <button
              type="button"
              role="switch"
              aria-checked={settingsActive}
              onClick={() => setSettingsActive(!settingsActive)}
              className={cn(
                "mt-1 inline-flex h-9 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                settingsActive ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
                  settingsActive ? "translate-x-7" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>

        <div className="mt-3">
          <Button
            size="sm"
            onClick={handleSaveSettings}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : null}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Questions header */}
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <HelpCircle className="h-4 w-4" />
          Questions ({questions.length})
        </h4>
        {!isAdding && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Question
          </Button>
        )}
      </div>

      {/* Existing questions */}
      {questions.map((q, idx) => {
        const qType = (q.question_type ?? "single") as SectionQuizQuestionType;
        const isSingle = qType === "single";

        return (
          <div
            key={q.id}
            className="rounded-lg border border-border bg-muted/30 p-4"
          >
            {editingId === q.id ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">
                    Question {idx + 1}
                  </Label>
                  <Input
                    value={editQuestionText}
                    onChange={(e) => setEditQuestionText(e.target.value)}
                    className="mt-1"
                  />
                </div>
                {renderQuestionTypeToggle(
                  editQuestionType,
                  editOptions,
                  setEditOptions,
                  setEditQuestionType
                )}
                {renderOptionEditor(editOptions, setEditOptions, editQuestionType)}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : null}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      Q{idx + 1}. {q.question_text}
                    </p>
                    {!isSingle && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Multi
                      </span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    {q.options.map((opt) => (
                      <div
                        key={opt.id}
                        className={cn(
                          "flex items-center gap-2 text-sm",
                          opt.is_correct
                            ? "font-medium text-green-700"
                            : "text-muted-foreground"
                        )}
                      >
                        {isSingle ? (
                          opt.is_correct ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Circle className="h-3.5 w-3.5" />
                          )
                        ) : opt.is_correct ? (
                          <CheckSquare className="h-3.5 w-3.5" />
                        ) : (
                          <Square className="h-3.5 w-3.5" />
                        )}
                        {opt.option_text}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditing(q)}
                  >
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Question</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this question and all its
                          options. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </AlertDialogClose>
                        <AlertDialogClose asChild>
                          <Button
                            variant="destructive"
                            onClick={() => handleDeleteQuestion(q.id)}
                          >
                            Delete
                          </Button>
                        </AlertDialogClose>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Empty state */}
      {questions.length === 0 && !isAdding && (
        <p className="py-4 text-center text-sm italic text-muted-foreground">
          No questions added yet. Add questions to make this quiz functional.
        </p>
      )}

      {/* New question form */}
      {isAdding && (
        <div className="space-y-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
          <div>
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              New Question
            </Label>
            <Input
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              placeholder="Enter your question..."
              className="mt-1"
              autoFocus
            />
          </div>
          {renderQuestionTypeToggle(
            newQuestionType,
            newOptions,
            setNewOptions,
            setNewQuestionType
          )}
          {renderOptionEditor(newOptions, setNewOptions, newQuestionType)}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSaveNew}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              Save Question
            </Button>
            <Button size="sm" variant="ghost" onClick={resetNewForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
