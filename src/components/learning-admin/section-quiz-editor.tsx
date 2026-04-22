"use client";

import { useState, useTransition } from "react";
import {
  createSectionQuiz,
  updateSectionQuiz,
  deleteSectionQuiz,
  createSectionQuizQuestionWithOptions,
  updateSectionQuizQuestionWithOptions,
  deleteSectionQuizQuestion,
} from "@/app/(protected)/learning/admin/courses/section-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  SectionQuiz,
  SectionQuizQuestionWithOptions,
  QuestionType,
} from "@/types/database.types";

interface SectionQuizEditorProps {
  sectionId: string;
  courseId: string;
  quiz: SectionQuiz | null;
  questions: SectionQuizQuestionWithOptions[];
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
  questions,
}: SectionQuizEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Quiz metadata edit state
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState(quiz?.title ?? "Section Quiz");
  const [metaPassingScore, setMetaPassingScore] = useState(
    quiz?.passing_score ?? 80
  );
  const [metaIsActive, setMetaIsActive] = useState(quiz?.is_active ?? true);

  // Question add/edit state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New question form state
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionType, setNewQuestionType] =
    useState<QuestionType>("single");
  const [newOptions, setNewOptions] = useState<OptionInput[]>([
    { option_text: "", is_correct: true, sort_order: 0 },
    { option_text: "", is_correct: false, sort_order: 1 },
  ]);

  // Edit question form state
  const [editQuestionText, setEditQuestionText] = useState("");
  const [editQuestionType, setEditQuestionType] =
    useState<QuestionType>("single");
  const [editOptions, setEditOptions] = useState<OptionInput[]>([]);

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
    setEditQuestionType((q.question_type ?? "single") as QuestionType);
    setEditOptions(
      q.options.map((o) => ({
        option_text: o.option_text,
        is_correct: o.is_correct,
        sort_order: o.sort_order,
      }))
    );
    setError(null);
  }

  // ─── Option helpers ──────────────────────────────────────────────

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
    questionType: QuestionType
  ) {
    if (opts.length <= 2) return;
    const updated = opts.filter((_, i) => i !== index);
    if (!updated.some((o) => o.is_correct)) {
      updated[0].is_correct = true;
    }
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
      opts.map((o, i) =>
        i === index ? { ...o, is_correct: !o.is_correct } : o
      )
    );
  }

  function handleQuestionTypeChange(
    newType: QuestionType,
    opts: OptionInput[],
    setOpts: (o: OptionInput[]) => void,
    setType: (t: QuestionType) => void
  ) {
    setType(newType);
    if (newType === "single") {
      const firstCorrectIdx = opts.findIndex((o) => o.is_correct);
      const idx = firstCorrectIdx >= 0 ? firstCorrectIdx : 0;
      setOpts(opts.map((o, i) => ({ ...o, is_correct: i === idx })));
    }
  }

  // ─── Quiz CRUD ──────────────────────────────────────────────────

  function handleCreateQuiz() {
    startTransition(async () => {
      setError(null);
      const result = await createSectionQuiz({
        section_id: sectionId,
        course_id: courseId,
      });
      if (result.success) {
        toast.success("Quiz created");
      } else {
        setError(result.error ?? "Failed to create quiz");
        toast.error(result.error ?? "Failed to create quiz");
      }
    });
  }

  function handleSaveMeta() {
    if (!quiz) return;
    startTransition(async () => {
      setError(null);
      const result = await updateSectionQuiz(quiz.id, courseId, {
        title: metaTitle,
        passing_score: metaPassingScore,
        is_active: metaIsActive,
      });
      if (result.success) {
        toast.success("Quiz settings saved");
        setIsEditingMeta(false);
      } else {
        setError(result.error ?? "Failed to update quiz");
        toast.error(result.error ?? "Failed to update quiz");
      }
    });
  }

  function handleDeleteQuiz() {
    if (!quiz) return;
    startTransition(async () => {
      setError(null);
      const result = await deleteSectionQuiz(quiz.id, courseId);
      if (result.success) {
        toast.success("Quiz deleted");
      } else {
        setError(result.error ?? "Failed to delete quiz");
        toast.error(result.error ?? "Failed to delete quiz");
      }
    });
  }

  // ─── Question CRUD ──────────────────────────────────────────────

  function handleSaveNewQuestion() {
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
      const result = await createSectionQuizQuestionWithOptions({
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
      if (result.success) {
        toast.success("Question saved");
        resetNewForm();
      } else {
        setError(result.error ?? "Failed to create question");
        toast.error(result.error ?? "Failed to create question");
      }
    });
  }

  function handleSaveEditQuestion() {
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
      const result = await updateSectionQuizQuestionWithOptions(
        editingId,
        courseId,
        {
          question_text: editQuestionText.trim(),
          question_type: editQuestionType,
          options: editOptions.map((o) => ({
            option_text: o.option_text.trim(),
            is_correct: o.is_correct,
            sort_order: o.sort_order,
          })),
        }
      );
      if (result.success) {
        toast.success("Question saved");
        setEditingId(null);
        setError(null);
      } else {
        setError(result.error ?? "Failed to update question");
        toast.error(result.error ?? "Failed to update question");
      }
    });
  }

  function handleDeleteQuestion(questionId: string) {
    startTransition(async () => {
      setError(null);
      const result = await deleteSectionQuizQuestion(questionId, courseId);
      if (result.success) {
        toast.success("Question deleted");
      } else {
        setError(result.error ?? "Failed to delete question");
        toast.error(result.error ?? "Failed to delete question");
      }
    });
  }

  // ─── Render helpers ──────────────────────────────────────────────

  function renderQuestionTypeToggle(
    questionType: QuestionType,
    opts: OptionInput[],
    setOpts: (o: OptionInput[]) => void,
    setType: (t: QuestionType) => void
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
    questionType: QuestionType
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

  // ─── No quiz — show add button ──────────────────────────────────

  if (!quiz) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <HelpCircle className="h-4 w-4" />
          <span>No section quiz — learners can proceed freely.</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCreateQuiz}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Plus className="mr-1 h-4 w-4" />
          )}
          Add Quiz
        </Button>
      </div>
    );
  }

  // ─── Quiz exists — show editor ──────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Quiz metadata */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
        {isEditingMeta ? (
          <div className="flex flex-1 items-center gap-3">
            <Input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="Quiz title"
              className="max-w-[200px]"
            />
            <div className="flex items-center gap-2">
              <Label htmlFor="passing-score" className="text-xs whitespace-nowrap">
                Pass:
              </Label>
              <Input
                id="passing-score"
                type="number"
                min={1}
                max={100}
                value={metaPassingScore}
                onChange={(e) =>
                  setMetaPassingScore(parseInt(e.target.value, 10) || 80)
                }
                className="w-16"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="quiz-active"
                checked={metaIsActive}
                onCheckedChange={setMetaIsActive}
              />
              <Label htmlFor="quiz-active" className="text-xs">
                Active
              </Label>
            </div>
            <Button size="sm" onClick={handleSaveMeta} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMetaTitle(quiz.title);
                setMetaPassingScore(quiz.passing_score);
                setMetaIsActive(quiz.is_active);
                setIsEditingMeta(false);
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{quiz.title}</p>
                <p className="text-xs text-muted-foreground">
                  {quiz.passing_score}% to pass · {questions.length} question
                  {questions.length !== 1 ? "s" : ""}
                  {!quiz.is_active && " · Inactive"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsEditingMeta(true)}
                aria-label="Edit quiz metadata"
                title="Edit"
              >
                <Pencil />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete section quiz"
                    title="Delete quiz"
                  >
                    <Trash2 />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Section Quiz</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this quiz and all its
                      questions. Learners will be able to proceed to the next
                      section without a quiz. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </AlertDialogClose>
                    <AlertDialogClose asChild>
                      <Button
                        variant="destructive"
                        onClick={handleDeleteQuiz}
                      >
                        Delete Quiz
                      </Button>
                    </AlertDialogClose>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Questions list */}
      {questions.map((q, idx) => {
        const qType = (q.question_type ?? "single") as QuestionType;
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
                {renderOptionEditor(
                  editOptions,
                  setEditOptions,
                  editQuestionType
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveEditQuestion}
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
        <p className="py-2 text-center text-sm italic text-muted-foreground">
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
              onClick={handleSaveNewQuestion}
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

      {/* Add question button */}
      {!isAdding && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Question
          </Button>
        </div>
      )}
    </div>
  );
}
