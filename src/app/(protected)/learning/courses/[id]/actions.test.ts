import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock strategy: Mock getCurrentUser() from @/lib/auth instead of
 * the low-level Supabase client. This matches the CLAUDE.md pattern.
 */

const mockInsert = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

const mockSupabase = vi.hoisted(() => ({
  from: mockFrom,
  rpc: mockRpc,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    supabase: mockSupabase,
    user: { id: "user-1", email: "test@mcrpathways.org" },
    profile: { id: "user-1" },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  enrollInCourse,
  completeLesson,
  submitQuiz,
} from "@/app/(protected)/learning/courses/[id]/actions";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

describe("Course Learner Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated user
    vi.mocked(getCurrentUser).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "user-1", email: "test@mcrpathways.org" } as never,
      profile: { id: "user-1" } as never,
    });

    // Default: insert succeeds
    mockInsert.mockResolvedValue({ error: null });

    // Default: from returns insert
    mockFrom.mockReturnValue({ insert: mockInsert });

    // Default: RPC succeeds
    mockRpc.mockResolvedValue({ data: 75, error: null });
  });

  // ===========================================
  // enrollInCourse
  // ===========================================

  describe("enrollInCourse", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null,
        profile: null,
      });

      const result = await enrollInCourse("course-1");

      expect(result).toEqual({ success: false, error: "Not authenticated" });
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("inserts enrollment with correct fields", async () => {
      await enrollInCourse("course-1");

      expect(mockFrom).toHaveBeenCalledWith("course_enrollments");
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: "user-1",
        course_id: "course-1",
        status: "enrolled",
        progress_percent: 0,
      });
    });

    it("returns success on successful enrollment", async () => {
      const result = await enrollInCourse("course-1");

      expect(result).toEqual({ success: true, error: null });
    });

    it("revalidates correct paths on success", async () => {
      await enrollInCourse("course-1");

      expect(revalidatePath).toHaveBeenCalledWith("/learning/courses/course-1");
      expect(revalidatePath).toHaveBeenCalledWith("/learning");
      expect(revalidatePath).toHaveBeenCalledWith("/learning/my-courses");
    });

    it("returns 'Already enrolled' for duplicate enrollment (code 23505)", async () => {
      mockInsert.mockResolvedValue({
        error: { code: "23505", message: "duplicate key value" },
      });

      const result = await enrollInCourse("course-1");

      expect(result).toEqual({
        success: false,
        error: "Already enrolled in this course",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("returns DB error message on generic failure", async () => {
      mockInsert.mockResolvedValue({
        error: { code: "42000", message: "Database connection error" },
      });

      const result = await enrollInCourse("course-1");

      expect(result).toEqual({
        success: false,
        error: "Database connection error",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  // ===========================================
  // completeLesson
  // ===========================================

  describe("completeLesson", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null,
        profile: null,
      });

      const result = await completeLesson("lesson-1", "course-1");

      expect(result).toEqual({
        success: false,
        error: "Not authenticated",
        progressPercent: null,
      });
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("calls RPC with correct parameters", async () => {
      await completeLesson("lesson-1", "course-1");

      expect(mockRpc).toHaveBeenCalledWith(
        "complete_lesson_and_update_progress",
        {
          p_user_id: "user-1",
          p_lesson_id: "lesson-1",
          p_course_id: "course-1",
        }
      );
    });

    it("returns progressPercent on success", async () => {
      mockRpc.mockResolvedValue({ data: 75, error: null });

      const result = await completeLesson("lesson-1", "course-1");

      expect(result).toEqual({
        success: true,
        error: null,
        progressPercent: 75,
      });
    });

    it("revalidates correct paths on success", async () => {
      await completeLesson("lesson-1", "course-1");

      expect(revalidatePath).toHaveBeenCalledWith("/learning/courses/course-1");
      expect(revalidatePath).toHaveBeenCalledWith("/learning");
      expect(revalidatePath).toHaveBeenCalledWith("/learning/my-courses");
    });

    it("returns error on RPC failure", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "RPC failed" },
      });

      const result = await completeLesson("lesson-1", "course-1");

      expect(result).toEqual({
        success: false,
        error: "RPC failed",
        progressPercent: null,
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  // ===========================================
  // submitQuiz
  // ===========================================

  describe("submitQuiz", () => {
    const mockQuizResult = {
      score: 80,
      passed: true,
      correct_answers: 4,
      total_questions: 5,
      progress_percent: 100,
    };

    beforeEach(() => {
      mockRpc.mockResolvedValue({ data: mockQuizResult, error: null });
    });

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null,
        profile: null,
      });

      const result = await submitQuiz("lesson-1", "course-1", { q1: "a" });

      expect(result).toEqual({
        success: false,
        error: "Not authenticated",
        result: null,
      });
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("calls RPC with correct parameters including answers", async () => {
      const answers = { q1: "a", q2: ["b", "c"] };

      await submitQuiz("lesson-1", "course-1", answers);

      expect(mockRpc).toHaveBeenCalledWith("submit_quiz_attempt", {
        p_user_id: "user-1",
        p_lesson_id: "lesson-1",
        p_course_id: "course-1",
        p_answers: answers,
      });
    });

    it("returns structured result on success", async () => {
      const result = await submitQuiz("lesson-1", "course-1", { q1: "a" });

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.result).toEqual(mockQuizResult);
    });

    it("revalidates 4 paths on success (including lesson path)", async () => {
      await submitQuiz("lesson-1", "course-1", { q1: "a" });

      expect(revalidatePath).toHaveBeenCalledWith("/learning/courses/course-1");
      expect(revalidatePath).toHaveBeenCalledWith(
        "/learning/courses/course-1/lessons/lesson-1"
      );
      expect(revalidatePath).toHaveBeenCalledWith("/learning");
      expect(revalidatePath).toHaveBeenCalledWith("/learning/my-courses");
      expect(revalidatePath).toHaveBeenCalledTimes(4);
    });

    it("returns error on RPC failure", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "Quiz submission failed" },
      });

      const result = await submitQuiz("lesson-1", "course-1", { q1: "a" });

      expect(result).toEqual({
        success: false,
        error: "Quiz submission failed",
        result: null,
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });
});
