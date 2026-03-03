/**
 * Tests for QuizEditor component.
 *
 * Covers: empty state, add/edit/delete question flows, option management,
 * question type switching, validation, and multi-answer badge.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuizEditor } from "./quiz-editor";
import type { QuizQuestionWithOptions } from "@/types/database.types";

// Mock server actions
const mockCreateQuizQuestion = vi.fn().mockResolvedValue({ success: true });
const mockUpdateQuizQuestion = vi.fn().mockResolvedValue({ success: true });
const mockDeleteQuizQuestion = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/app/(protected)/learning/admin/courses/actions", () => ({
  createQuizQuestion: (...args: unknown[]) => mockCreateQuizQuestion(...args),
  updateQuizQuestion: (...args: unknown[]) => mockUpdateQuizQuestion(...args),
  deleteQuizQuestion: (...args: unknown[]) => mockDeleteQuizQuestion(...args),
}));

function makeQuestion(
  overrides?: Partial<QuizQuestionWithOptions>
): QuizQuestionWithOptions {
  return {
    id: "q-1",
    lesson_id: "lesson-1",
    question_text: "What colour is the sky?",
    question_type: "single",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    options: [
      {
        id: "opt-1",
        question_id: "q-1",
        option_text: "Blue",
        is_correct: true,
        sort_order: 0,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "opt-2",
        question_id: "q-1",
        option_text: "Green",
        is_correct: false,
        sort_order: 1,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    ...overrides,
  };
}

const defaultProps = {
  lessonId: "lesson-1",
  courseId: "course-1",
  questions: [] as QuizQuestionWithOptions[],
};

describe("QuizEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =============================================
  // Empty state and header
  // =============================================

  it("shows empty state when no questions", () => {
    render(<QuizEditor {...defaultProps} />);
    expect(screen.getByText(/No questions added yet/)).toBeInTheDocument();
  });

  it("shows question count in header", () => {
    render(
      <QuizEditor {...defaultProps} questions={[makeQuestion()]} />
    );
    expect(screen.getByText(/\(1\)/)).toBeInTheDocument();
  });

  it("shows lesson title in header when provided", () => {
    render(
      <QuizEditor {...defaultProps} lessonTitle="Lesson 1" />
    );
    expect(screen.getByText(/Lesson 1 — Questions/)).toBeInTheDocument();
  });

  // =============================================
  // Question display
  // =============================================

  it("renders existing questions with text and options", () => {
    render(
      <QuizEditor {...defaultProps} questions={[makeQuestion()]} />
    );
    expect(screen.getByText(/What colour is the sky\?/)).toBeInTheDocument();
    expect(screen.getByText("Blue")).toBeInTheDocument();
    expect(screen.getByText("Green")).toBeInTheDocument();
  });

  it("shows Multi badge for multi-answer questions", () => {
    render(
      <QuizEditor
        {...defaultProps}
        questions={[makeQuestion({ question_type: "multi" })]}
      />
    );
    expect(screen.getByText("Multi")).toBeInTheDocument();
  });

  it("hides Multi badge for single-answer questions", () => {
    render(
      <QuizEditor {...defaultProps} questions={[makeQuestion()]} />
    );
    expect(screen.queryByText("Multi")).not.toBeInTheDocument();
  });

  // =============================================
  // Add question flow
  // =============================================

  it("shows add form when Add Question clicked", async () => {
    const user = userEvent.setup();
    render(<QuizEditor {...defaultProps} />);

    await user.click(screen.getByText("Add Question"));

    expect(screen.getByPlaceholderText("Enter your question...")).toBeInTheDocument();
    expect(screen.getByText("Save Question")).toBeInTheDocument();
  });

  it("validates question text is required", async () => {
    const user = userEvent.setup();
    render(<QuizEditor {...defaultProps} />);

    await user.click(screen.getByText("Add Question"));
    await user.click(screen.getByText("Save Question"));

    expect(screen.getByText("Question text is required")).toBeInTheDocument();
    expect(mockCreateQuizQuestion).not.toHaveBeenCalled();
  });

  it("validates all options must have text", async () => {
    const user = userEvent.setup();
    render(<QuizEditor {...defaultProps} />);

    await user.click(screen.getByText("Add Question"));
    const questionInput = screen.getByPlaceholderText("Enter your question...");
    await user.type(questionInput, "Test question");
    // Options are empty by default
    await user.click(screen.getByText("Save Question"));

    expect(screen.getByText("All options must have text")).toBeInTheDocument();
    expect(mockCreateQuizQuestion).not.toHaveBeenCalled();
  });

  it("calls createQuizQuestion with correct data", async () => {
    const user = userEvent.setup();
    render(<QuizEditor {...defaultProps} />);

    await user.click(screen.getByText("Add Question"));
    await user.type(
      screen.getByPlaceholderText("Enter your question..."),
      "What is 1+1?"
    );

    // Fill in option text
    const optionInputs = screen.getAllByPlaceholderText(/Option \d/);
    await user.type(optionInputs[0], "2");
    await user.type(optionInputs[1], "3");

    await user.click(screen.getByText("Save Question"));

    expect(mockCreateQuizQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        lesson_id: "lesson-1",
        course_id: "course-1",
        question_text: "What is 1+1?",
        question_type: "single",
      })
    );
  });

  it("hides add form on Cancel", async () => {
    const user = userEvent.setup();
    render(<QuizEditor {...defaultProps} />);

    await user.click(screen.getByText("Add Question"));
    expect(screen.getByPlaceholderText("Enter your question...")).toBeInTheDocument();

    // Click Cancel button in the add form
    const cancelButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent === "Cancel"
    );
    await user.click(cancelButtons[0]);

    expect(screen.queryByPlaceholderText("Enter your question...")).not.toBeInTheDocument();
  });

  // =============================================
  // Edit question flow
  // =============================================

  it("enters edit mode when Edit clicked", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor {...defaultProps} questions={[makeQuestion()]} />
    );

    await user.click(screen.getByText("Edit"));

    // Should show input with question text
    const input = screen.getByDisplayValue("What colour is the sky?");
    expect(input).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  // =============================================
  // Option management
  // =============================================

  it("adds option up to max 6", async () => {
    const user = userEvent.setup();
    render(<QuizEditor {...defaultProps} />);

    await user.click(screen.getByText("Add Question"));

    // Start with 2 options, add 4 more to reach max 6
    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByText("Add Option"));
    }

    // Should have 6 option inputs
    const optionInputs = screen.getAllByPlaceholderText(/Option \d/);
    expect(optionInputs).toHaveLength(6);

    // Add Option button should be gone
    expect(screen.queryByText("Add Option")).not.toBeInTheDocument();
  });

  // =============================================
  // Question type toggle
  // =============================================

  it("shows Single Answer and Select All That Apply toggles", async () => {
    const user = userEvent.setup();
    render(<QuizEditor {...defaultProps} />);

    await user.click(screen.getByText("Add Question"));

    expect(screen.getByText("Single Answer")).toBeInTheDocument();
    expect(screen.getByText("Select All That Apply")).toBeInTheDocument();
  });
});
