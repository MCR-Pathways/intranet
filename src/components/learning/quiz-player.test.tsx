/**
 * Tests for QuizPlayer component.
 *
 * Covers: completed state, question rendering, answer selection
 * (single/multi), submit behaviour, pass/fail results, and retry.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuizPlayer } from "./quiz-player";
import type { QuizQuestionWithOptions, QuizAttempt } from "@/types/database.types";

// Mock server action
const mockSubmitQuiz = vi.fn();

vi.mock("@/app/(protected)/learning/courses/[id]/actions", () => ({
  submitQuiz: (...args: unknown[]) => mockSubmitQuiz(...args),
}));

function makeQuestion(
  overrides?: Partial<QuizQuestionWithOptions>
): QuizQuestionWithOptions {
  return {
    id: "q-1",
    lesson_id: "lesson-1",
    question_text: "What is 2+2?",
    question_type: "single",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    options: [
      {
        id: "opt-1",
        question_id: "q-1",
        option_text: "3",
        is_correct: false,
        sort_order: 0,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "opt-2",
        question_id: "q-1",
        option_text: "4",
        is_correct: true,
        sort_order: 1,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    ...overrides,
  };
}

function makeAttempt(overrides?: Partial<QuizAttempt>): QuizAttempt {
  return {
    id: "attempt-1",
    user_id: "user-1",
    lesson_id: "lesson-1",
    score: 80,
    passed: true,
    answers: null,
    attempted_at: "2026-01-15T10:00:00Z",
    ...overrides,
  };
}

const defaultProps = {
  lessonId: "lesson-1",
  courseId: "course-1",
  questions: [makeQuestion()],
  passingScore: 70,
  previousAttempts: [],
  isCompleted: false,
};

describe("QuizPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =============================================
  // Completed state
  // =============================================

  it("shows completed state with trophy when quiz already completed", () => {
    render(
      <QuizPlayer
        {...defaultProps}
        isCompleted={true}
        previousAttempts={[makeAttempt({ score: 90 })]}
      />
    );
    expect(screen.getByText("Quiz Completed")).toBeInTheDocument();
    expect(screen.getByText("Your best score: 90%")).toBeInTheDocument();
  });

  it("shows all-lessons-complete message on last lesson", () => {
    render(
      <QuizPlayer
        {...defaultProps}
        isCompleted={true}
        isLastLesson={true}
        previousAttempts={[makeAttempt()]}
      />
    );
    expect(
      screen.getByText("All lessons in this course are complete.")
    ).toBeInTheDocument();
  });

  it("hides all-lessons-complete message on non-last lesson", () => {
    render(
      <QuizPlayer
        {...defaultProps}
        isCompleted={true}
        isLastLesson={false}
        previousAttempts={[makeAttempt()]}
      />
    );
    expect(
      screen.queryByText("All lessons in this course are complete.")
    ).not.toBeInTheDocument();
  });

  // =============================================
  // Quiz rendering
  // =============================================

  it("renders question text and options", () => {
    render(<QuizPlayer {...defaultProps} />);
    expect(screen.getByText(/What is 2\+2\?/)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("shows pass mark info", () => {
    render(<QuizPlayer {...defaultProps} />);
    expect(screen.getByText(/70%/)).toBeInTheDocument();
    expect(screen.getByText(/required to continue/)).toBeInTheDocument();
  });

  it("shows 'required to complete' on last lesson", () => {
    render(<QuizPlayer {...defaultProps} isLastLesson={true} />);
    expect(screen.getByText(/required to complete/)).toBeInTheDocument();
  });

  it("shows 'Select all that apply' hint for multi-answer questions", () => {
    render(
      <QuizPlayer
        {...defaultProps}
        questions={[makeQuestion({ question_type: "multi" })]}
      />
    );
    expect(screen.getByText("Select all that apply")).toBeInTheDocument();
  });

  // =============================================
  // Answer selection
  // =============================================

  it("disables submit when not all questions answered", () => {
    render(<QuizPlayer {...defaultProps} />);
    const submitBtn = screen.getByText("Submit Quiz");
    expect(submitBtn.closest("button")).toBeDisabled();
  });

  it("enables submit after selecting an answer", async () => {
    const user = userEvent.setup();
    render(<QuizPlayer {...defaultProps} />);

    await user.click(screen.getByText("4"));

    const submitBtn = screen.getByText("Submit Quiz");
    expect(submitBtn.closest("button")).not.toBeDisabled();
  });

  // =============================================
  // Submit and results
  // =============================================

  it("shows pass result after successful submission", async () => {
    const user = userEvent.setup();
    mockSubmitQuiz.mockResolvedValue({
      success: true,
      result: {
        score: 100,
        passed: true,
        correct_answers: 1,
        total_questions: 1,
        progress_percent: 100,
      },
    });

    render(<QuizPlayer {...defaultProps} />);
    await user.click(screen.getByText("4"));
    await user.click(screen.getByText("Submit Quiz"));

    expect(await screen.findByText("100%")).toBeInTheDocument();
    expect(screen.getByText("1 of 1 correct")).toBeInTheDocument();
    expect(screen.getByText(/Quiz Passed/)).toBeInTheDocument();
  });

  it("shows proceed message on pass (non-last lesson)", async () => {
    const user = userEvent.setup();
    mockSubmitQuiz.mockResolvedValue({
      success: true,
      result: {
        score: 100,
        passed: true,
        correct_answers: 1,
        total_questions: 1,
        progress_percent: 100,
      },
    });

    render(<QuizPlayer {...defaultProps} isLastLesson={false} />);
    await user.click(screen.getByText("4"));
    await user.click(screen.getByText("Submit Quiz"));

    expect(
      await screen.findByText(/proceed to the next lesson/)
    ).toBeInTheDocument();
  });

  it("shows course complete message on pass (last lesson)", async () => {
    const user = userEvent.setup();
    mockSubmitQuiz.mockResolvedValue({
      success: true,
      result: {
        score: 100,
        passed: true,
        correct_answers: 1,
        total_questions: 1,
        progress_percent: 100,
      },
    });

    render(<QuizPlayer {...defaultProps} isLastLesson={true} />);
    await user.click(screen.getByText("4"));
    await user.click(screen.getByText("Submit Quiz"));

    expect(
      await screen.findByText(/completed all lessons/)
    ).toBeInTheDocument();
  });

  it("shows fail result with retry button", async () => {
    const user = userEvent.setup();
    mockSubmitQuiz.mockResolvedValue({
      success: true,
      result: {
        score: 40,
        passed: false,
        correct_answers: 0,
        total_questions: 1,
        progress_percent: 50,
      },
    });

    render(<QuizPlayer {...defaultProps} />);
    await user.click(screen.getByText("3"));
    await user.click(screen.getByText("Submit Quiz"));

    expect(await screen.findByText("40%")).toBeInTheDocument();
    expect(screen.getByText(/Score too low/)).toBeInTheDocument();
    expect(screen.getByText("Retry Quiz")).toBeInTheDocument();
  });

  it("resets quiz on retry", async () => {
    const user = userEvent.setup();
    mockSubmitQuiz.mockResolvedValue({
      success: true,
      result: {
        score: 40,
        passed: false,
        correct_answers: 0,
        total_questions: 1,
        progress_percent: 50,
      },
    });

    render(<QuizPlayer {...defaultProps} />);
    await user.click(screen.getByText("3"));
    await user.click(screen.getByText("Submit Quiz"));
    await screen.findByText("Retry Quiz");
    await user.click(screen.getByText("Retry Quiz"));

    // Back to quiz state — submit button should be visible and disabled
    expect(screen.getByText("Submit Quiz")).toBeInTheDocument();
    expect(screen.getByText("Submit Quiz").closest("button")).toBeDisabled();
    // Score should be gone
    expect(screen.queryByText("40%")).not.toBeInTheDocument();
  });

  it("shows error when submission fails", async () => {
    const user = userEvent.setup();
    mockSubmitQuiz.mockResolvedValue({
      success: false,
      error: "Server error",
    });

    render(<QuizPlayer {...defaultProps} />);
    await user.click(screen.getByText("4"));
    await user.click(screen.getByText("Submit Quiz"));

    expect(await screen.findByText("Server error")).toBeInTheDocument();
  });
});
