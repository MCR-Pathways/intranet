"use client";

import { useState, useTransition } from "react";
import {
  createQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
} from "@/app/(protected)/learning/admin/courses/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuizQuestionWithOptions } from "@/types/database.types";

interface QuizEditorProps {
  lessonId: string;
  courseId: string;
  lessonTitle?: string;
  questions: QuizQuestionWithOptions[];
}

interface OptionInput {
  option_text: string;
  is_correct: boolean;
  sort_order: number;
}

export function QuizEditor({ lessonId, courseId, lessonTitle, questions }: QuizEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New question form state
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newOptions, setNewOptions] = useState<OptionInput[]>([
    { option_text: "", is_correct: true, sort_order: 0 },
    { option_text: "", is_correct: false, sort_order: 1 },
  ]);

  // Edit question form state
  const [editQuestionText, setEditQuestionText] = useState("");
  const [editOptions, setEditOptions] = useState<OptionInput[]>([]);

  function resetNewForm() {
    setNewQuestionText("");
    setNewOptions([
      { option_text: "", is_correct: true, sort_order: 0 },
      { option_text: "", is_correct: false, sort_order: 1 },
    ]);
    setIsAdding(false);
    setError(null);
  }

  function startEditing(q: QuizQuestionWithOptions) {
    setEditingId(q.id);
    setEditQuestionText(q.question_text);
    setEditOptions(
      q.options.map((o) => ({
        option_text: o.option_text,
        is_correct: o.is_correct,
        sort_order: o.sort_order,
      }))
    );
    setError(null);
  }

  function handleAddOption(opts: OptionInput[], setOpts: (o: OptionInput[]) => void) {
    setOpts([
      ...opts,
      { option_text: "", is_correct: false, sort_order: opts.length },
    ]);
  }

  function handleRemoveOption(
    opts: OptionInput[],
    setOpts: (o: OptionInput[]) => void,
    index: number
  ) {
    if (opts.length <= 2) return;
    const updated = opts.filter((_, i) => i !== index);
    // If we removed the correct answer, make the first one correct
    if (!updated.some((o) => o.is_correct)) {
      updated[0].is_correct = true;
    }
    setOpts(updated.map((o, i) => ({ ...o, sort_order: i })));
  }

  function handleSetCorrect(
    opts: OptionInput[],
    setOpts: (o: OptionInput[]) => void,
    index: number
  ) {
    setOpts(opts.map((o, i) => ({ ...o, is_correct: i === index })));
  }

  function handleSaveNew() {
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
      const result = await createQuizQuestion({
        lesson_id: lessonId,
        course_id: courseId,
        question_text: newQuestionText.trim(),
        sort_order: questions.length,
        options: newOptions.map((o) => ({
          option_text: o.option_text.trim(),
          is_correct: o.is_correct,
          sort_order: o.sort_order,
        })),
      });
      if (!result.success) {
        setError(result.error ?? "Failed to create question");
      } else {
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
      const result = await updateQuizQuestion(editingId, courseId, {
        question_text: editQuestionText.trim(),
        options: editOptions.map((o) => ({
          option_text: o.option_text.trim(),
          is_correct: o.is_correct,
          sort_order: o.sort_order,
        })),
      });
      if (!result.success) {
        setError(result.error ?? "Failed to update question");
      } else {
        setEditingId(null);
        setError(null);
      }
    });
  }

  function handleDelete(questionId: string) {
    startTransition(async () => {
      setError(null);
      const result = await deleteQuizQuestion(questionId, courseId);
      if (!result.success) {
        setError(result.error ?? "Failed to delete question");
      }
    });
  }

  function renderOptionEditor(
    opts: OptionInput[],
    setOpts: (o: OptionInput[]) => void
  ) {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">
          Options (click circle to mark correct)
        </Label>
        {opts.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSetCorrect(opts, setOpts, idx)}
              className="shrink-0"
              title={opt.is_correct ? "Correct answer" : "Mark as correct"}
            >
              {opt.is_correct ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
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
                onClick={() => handleRemoveOption(opts, setOpts, idx)}
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="h-5 w-5" />
            {lessonTitle ? `${lessonTitle} — Questions` : "Quiz Questions"} ({questions.length})
          </CardTitle>
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
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error display */}
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Existing questions */}
        {questions.map((q, idx) => (
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
                {renderOptionEditor(editOptions, setEditOptions)}
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
                  <p className="font-medium">
                    Q{idx + 1}. {q.question_text}
                  </p>
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
                        {opt.is_correct ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Circle className="h-3.5 w-3.5" />
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
                            onClick={() => handleDelete(q.id)}
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
        ))}

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
            {renderOptionEditor(newOptions, setNewOptions)}
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
              <Button
                size="sm"
                variant="ghost"
                onClick={resetNewForm}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
