import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock strategy: Instead of mocking the low-level Supabase client (which
 * involves complex fluent chain re-wiring), we mock `@/lib/auth` directly.
 * This lets us control what `requireLDAdmin()` returns without dealing
 * with the `.from().select().eq().single()` chain it uses internally.
 *
 * The actions use the `supabase` object returned by requireLDAdmin()
 * for fluent chains like `.from("courses").insert({...}).select("id").single()`.
 */

// Create mock chain functions for DB operations used by the actions
const mockEq = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockSingle = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

// Mock Supabase client returned by requireLDAdmin
const mockSupabase = vi.hoisted(() => ({
  from: mockFrom,
  rpc: mockRpc,
}));

// Mock requireLDAdmin -- returns { supabase, user } on success
vi.mock("@/lib/auth", () => ({
  requireLDAdmin: vi.fn().mockResolvedValue({
    supabase: mockSupabase,
    user: { id: "admin-123", email: "admin@mcrpathways.org" },
  }),
}));

// Mock next/cache (revalidatePath used after mutations)
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock logger to prevent console output during tests
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import modules under test AFTER mocks are registered
import {
  createCourse,
  updateCourse,
  publishCourse,
  unpublishCourse,
} from "@/app/(protected)/learning/admin/courses/actions";
import { requireLDAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

describe("L&D Course Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: requireLDAdmin succeeds
    vi.mocked(requireLDAdmin).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "admin-123", email: "admin@mcrpathways.org" } as never,
    });
  });

  // =========================================
  // createCourse
  // =========================================
  describe("createCourse", () => {
    beforeEach(() => {
      // Wire chain: .from("courses").insert({}).select("id").single()
      mockSingle.mockResolvedValue({ data: { id: "course-001" }, error: null });
      mockSelect.mockReturnValue({ single: mockSingle });
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });
    });

    it("creates a course with sanitized fields and returns courseId", async () => {
      const result = await createCourse({
        title: "Intro to Pathways",
        description: "A beginner course",
        category: "compliance",
        duration_minutes: 30,
        is_required: true,
      });

      expect(result).toEqual({ success: true, error: null, courseId: "course-001" });
      expect(mockFrom).toHaveBeenCalledWith("courses");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Intro to Pathways",
          description: "A beginner course",
          category: "compliance",
          duration_minutes: 30,
          is_required: true,
          created_by: "admin-123",
          is_active: false,
        })
      );
      expect(mockSelect).toHaveBeenCalledWith("id");
      expect(revalidatePath).toHaveBeenCalledWith("/learning/admin/courses");
      expect(revalidatePath).toHaveBeenCalledWith("/learning/courses");
    });

    it("forces is_active to false regardless of input", async () => {
      await createCourse({
        title: "Test",
        category: "compliance",
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
        })
      );
    });

    it("sets created_by to the authenticated user ID", async () => {
      await createCourse({
        title: "Test",
        category: "compliance",
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          created_by: "admin-123",
        })
      );
    });

    it("returns error when DB insert fails", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "Duplicate title" },
      });

      const result = await createCourse({
        title: "Existing Course",
        category: "compliance",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to create course. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
        courseId: null,
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("throws when user is not authenticated", async () => {
      vi.mocked(requireLDAdmin).mockRejectedValue(
        new Error("Not authenticated")
      );

      await expect(
        createCourse({ title: "Test", category: "compliance" })
      ).rejects.toThrow("Not authenticated");
    });

    it("throws when user is not an L&D admin", async () => {
      vi.mocked(requireLDAdmin).mockRejectedValue(
        new Error("Unauthorised: L&D admin access required")
      );

      await expect(
        createCourse({ title: "Test", category: "compliance" })
      ).rejects.toThrow("Unauthorised: L&D admin access required");
    });
  });

  // =========================================
  // updateCourse
  // =========================================
  describe("updateCourse", () => {
    beforeEach(() => {
      // Wire chain: .from("courses").update({}).eq("id", courseId)
      mockEq.mockResolvedValue({ error: null });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });
    });

    it("updates a course with sanitized whitelisted fields", async () => {
      const result = await updateCourse("course-001", {
        title: "Updated Title",
        description: "New description",
        category: "compliance",
        duration_minutes: 45,
        is_required: false,
        content_url: "https://example.com/video",
      });

      expect(result).toEqual({ success: true, error: null });
      expect(mockFrom).toHaveBeenCalledWith("courses");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Updated Title",
          description: "New description",
          category: "compliance",
          duration_minutes: 45,
          is_required: false,
          content_url: "https://example.com/video",
          updated_by: "admin-123",
        })
      );
      expect(mockEq).toHaveBeenCalledWith("id", "course-001");
      expect(revalidatePath).toHaveBeenCalledWith("/learning/admin/courses");
      expect(revalidatePath).toHaveBeenCalledWith("/learning/admin/courses/course-001");
      expect(revalidatePath).toHaveBeenCalledWith("/learning/courses");
    });

    it("strips unknown fields from the update payload", async () => {
      await updateCourse("course-001", {
        title: "Safe Title",
        created_by: "SHOULD_BE_STRIPPED",
        id: "SHOULD_BE_STRIPPED",
      } as Record<string, unknown> as Parameters<typeof updateCourse>[1]);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Safe Title" })
      );
      const payload = mockUpdate.mock.calls[0][0];
      expect(payload).not.toHaveProperty("created_by");
      expect(payload).not.toHaveProperty("id");
    });

    it("returns error when no valid fields are provided", async () => {
      const result = await updateCourse(
        "course-001",
        {} as Parameters<typeof updateCourse>[1]
      );

      expect(result).toEqual({
        success: false,
        error: "No valid fields to update",
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("sets updated_by to the authenticated user ID", async () => {
      await updateCourse("course-001", { title: "New" });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ updated_by: "admin-123" })
      );
    });

    it("returns error when DB update fails", async () => {
      mockEq.mockResolvedValue({
        error: { message: "Database constraint violation" },
      });

      const result = await updateCourse("course-001", {
        title: "Bad Update",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to update course. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("throws when user is not authenticated", async () => {
      vi.mocked(requireLDAdmin).mockRejectedValue(
        new Error("Not authenticated")
      );

      await expect(
        updateCourse("course-001", { title: "Test" })
      ).rejects.toThrow("Not authenticated");
    });

    it("allows updating status and is_active fields", async () => {
      await updateCourse("course-001", {
        status: "published",
        is_active: true,
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "published",
          is_active: true,
          updated_by: "admin-123",
        })
      );
    });
  });

  // =========================================
  // publishCourse
  // =========================================
  describe("publishCourse", () => {
    /**
     * publishCourse has a complex chain:
     * 1. select lessons: .from("course_lessons").select("id, title, lesson_type").eq("course_id", ...).eq("is_active", true)
     * 2. optionally select quiz questions: .from("quiz_questions").select("lesson_id").in("lesson_id", [...])
     * 3. update course: .from("courses").update({}).eq("id", ...)
     * 4. notifyCoursePublished (internally calls requireLDAdmin again + supabase operations)
     *
     * We wire mockFrom to return different chains based on the table name.
     */

    function wirePublishMocks(options: {
      sections?: { id: string; title: string }[] | null;
      lessons?: { id: string; section_id: string }[] | null;
      quizQuestions?: { lesson_id: string }[] | null;
      sectionQuizzes?: { id: string; section_id: string; is_active: boolean }[] | null;
      sectionQuizQuestions?: { quiz_id: string }[] | null;
      updateError?: { message: string } | null;
      // For notifyCoursePublished (called after publish update succeeds)
      assignmentCount?: number;
      rpcResult?: { data: number | null; error: { message: string } | null };
    }) {
      const {
        sections = [{ id: "section-1", title: "Section 1" }],
        lessons = [{ id: "lesson-1", section_id: "section-1" }],
        quizQuestions = null,
        sectionQuizzes = null,
        sectionQuizQuestions = null,
        updateError = null,
        assignmentCount = 0,
        rpcResult = { data: 0, error: null },
      } = options;

      // Sections: .from("course_sections").select("id, title").eq("course_id", ...).eq("is_active", true)
      const mockSectionEq2 = vi.fn().mockResolvedValue({ data: sections, error: null });
      const mockSectionEq1 = vi.fn().mockReturnValue({ eq: mockSectionEq2 });
      const mockSectionSelect = vi.fn().mockReturnValue({ eq: mockSectionEq1 });

      // Lessons: .from("course_lessons").select("id, section_id").eq("course_id", ...).eq("is_active", true).in("section_id", [...])
      const mockLessonIn = vi.fn().mockResolvedValue({ data: lessons, error: null });
      const mockLessonEq2 = vi.fn().mockReturnValue({ in: mockLessonIn });
      const mockLessonEq1 = vi.fn().mockReturnValue({ eq: mockLessonEq2 });
      const mockLessonSelect = vi.fn().mockReturnValue({ eq: mockLessonEq1 });

      // Quiz questions (legacy): .from("quiz_questions").select("lesson_id").in("lesson_id", [...])
      const mockQuizIn = vi.fn().mockResolvedValue({ data: quizQuestions, error: null });
      const mockQuizSelect = vi.fn().mockReturnValue({ in: mockQuizIn });

      // Section quizzes: .from("section_quizzes").select("id, section_id").in("section_id", [...]).eq("is_active", true)
      const mockSQEq = vi.fn().mockResolvedValue({ data: sectionQuizzes, error: null });
      const mockSQIn = vi.fn().mockReturnValue({ eq: mockSQEq });
      const mockSQSelect = vi.fn().mockReturnValue({ in: mockSQIn });

      // Section quiz questions: .from("section_quiz_questions").select("quiz_id").in("quiz_id", [...])
      const mockSQQIn = vi.fn().mockResolvedValue({ data: sectionQuizQuestions, error: null });
      const mockSQQSelect = vi.fn().mockReturnValue({ in: mockSQQIn });

      // Course duration check: .from("courses").select("duration_minutes").eq("id", ...).single()
      const mockCourseDurationSingle = vi.fn().mockResolvedValue({ data: { duration_minutes: 45 }, error: null });
      const mockCourseDurationEq = vi.fn().mockReturnValue({ single: mockCourseDurationSingle });
      const mockCourseDurationSelect = vi.fn().mockReturnValue({ eq: mockCourseDurationEq });

      // Update course: .from("courses").update({}).eq("id", ...)
      const mockCourseEq = vi.fn().mockResolvedValue({ error: updateError });
      const mockCourseUpdate = vi.fn().mockReturnValue({ eq: mockCourseEq });

      // For notifyCoursePublished: .from("course_assignments").select("id", { count, head }).eq("course_id", ...)
      const mockAssignEq = vi.fn().mockResolvedValue({ count: assignmentCount, error: null });
      const mockAssignSelect = vi.fn().mockReturnValue({ eq: mockAssignEq });

      mockRpc.mockResolvedValue(rpcResult);

      mockFrom.mockImplementation((table: string) => {
        switch (table) {
          case "course_sections":
            return { select: mockSectionSelect };
          case "course_lessons":
            return { select: mockLessonSelect };
          case "quiz_questions":
            return { select: mockQuizSelect };
          case "section_quizzes":
            return { select: mockSQSelect };
          case "section_quiz_questions":
            return { select: mockSQQSelect };
          case "courses":
            return { select: mockCourseDurationSelect, update: mockCourseUpdate };
          case "course_assignments":
            return { select: mockAssignSelect };
          default:
            return {};
        }
      });

      return { mockCourseUpdate, mockCourseEq, mockLessonEq2: mockLessonIn, mockQuizIn };
    }

    it("publishes a course with at least one section and lesson", async () => {
      const { mockCourseUpdate, mockCourseEq } = wirePublishMocks({
        sections: [{ id: "section-1", title: "Section 1" }],
        lessons: [{ id: "lesson-1", section_id: "section-1" }],
      });

      const result = await publishCourse("course-001");

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.warnings).toBeDefined();
      expect(mockCourseUpdate).toHaveBeenCalledWith({
        status: "published",
        is_active: true,
        updated_by: "admin-123",
      });
      expect(mockCourseEq).toHaveBeenCalledWith("id", "course-001");
      expect(revalidatePath).toHaveBeenCalledWith("/learning/admin/courses");
      expect(revalidatePath).toHaveBeenCalledWith("/learning/admin/courses/course-001");
      expect(revalidatePath).toHaveBeenCalledWith("/learning/courses");
      expect(revalidatePath).toHaveBeenCalledWith("/learning");
    });

    it("returns error when course has no active sections", async () => {
      wirePublishMocks({ sections: [] });

      const result = await publishCourse("course-001");

      expect(result).toEqual({
        success: false,
        error: "Add at least one section before publishing.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("returns error when sections query returns null", async () => {
      wirePublishMocks({ sections: null });

      const result = await publishCourse("course-001");

      expect(result).toEqual({
        success: false,
        error: "Add at least one section before publishing.",
      });
    });

    it("returns error when sections have no lessons", async () => {
      wirePublishMocks({
        sections: [{ id: "section-1", title: "Section 1" }],
        lessons: [],
      });

      const result = await publishCourse("course-001");

      expect(result).toEqual({
        success: false,
        error: "Add at least one lesson before publishing.",
      });
    });

    it("returns error when a section quiz has no questions", async () => {
      wirePublishMocks({
        sections: [{ id: "section-1", title: "Section 1" }],
        lessons: [{ id: "lesson-1", section_id: "section-1" }],
        sectionQuizzes: [{ id: "quiz-1", section_id: "section-1", is_active: true }],
        sectionQuizQuestions: [], // No questions for the quiz
      });

      const result = await publishCourse("course-001");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("needs at least one question"),
      });
    });

    it("succeeds when section quizzes have questions", async () => {
      wirePublishMocks({
        sections: [{ id: "section-1", title: "Section 1" }],
        lessons: [{ id: "lesson-1", section_id: "section-1" }],
        sectionQuizzes: [{ id: "quiz-1", section_id: "section-1", is_active: true }],
        sectionQuizQuestions: [{ quiz_id: "quiz-1" }],
      });

      const result = await publishCourse("course-001");

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    it("returns error when DB update fails", async () => {
      wirePublishMocks({
        sections: [{ id: "section-1", title: "Section 1" }],
        lessons: [{ id: "lesson-1", section_id: "section-1" }],
        updateError: { message: "Update failed" },
      });

      const result = await publishCourse("course-001");

      expect(result).toEqual({ success: false, error: "Failed to publish course. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.", warnings: [] });
    });

    it("sends notifications when course has assignments", async () => {
      wirePublishMocks({
        sections: [{ id: "section-1", title: "Section 1" }],
        lessons: [{ id: "lesson-1", section_id: "section-1" }],
        assignmentCount: 5,
        rpcResult: { data: 5, error: null },
      });

      const result = await publishCourse("course-001");

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      // notifyCoursePublished is called which invokes the RPC
      expect(mockRpc).toHaveBeenCalledWith("notify_course_published", {
        p_course_id: "course-001",
        p_published_by: "admin-123",
      });
    });

    it("throws when user is not authenticated", async () => {
      vi.mocked(requireLDAdmin).mockRejectedValue(
        new Error("Not authenticated")
      );

      await expect(publishCourse("course-001")).rejects.toThrow(
        "Not authenticated"
      );
    });
  });

  // =========================================
  // unpublishCourse
  // =========================================
  describe("unpublishCourse", () => {
    /**
     * unpublishCourse chain:
     * 1. count enrolments: .from("course_enrolments").select("id", { count, head }).eq("course_id", ...)
     * 2. update course: .from("courses").update({}).eq("id", ...)
     */

    function wireUnpublishMocks(options: {
      enrolmentCount?: number | null;
      updateError?: { message: string } | null;
    }) {
      const { enrolmentCount = 0, updateError = null } = options;

      // Enrolment check: .from("course_enrolments").select(...).eq(...)
      const mockEnrolEq = vi.fn().mockResolvedValue({
        count: enrolmentCount,
        error: null,
      });
      const mockEnrolSelect = vi.fn().mockReturnValue({ eq: mockEnrolEq });

      // Update course: .from("courses").update({}).eq(...)
      const mockCourseEq = vi.fn().mockResolvedValue({ error: updateError });
      const mockCourseUpdate = vi.fn().mockReturnValue({ eq: mockCourseEq });

      mockFrom.mockImplementation((table: string) => {
        switch (table) {
          case "course_enrolments":
            return { select: mockEnrolSelect };
          case "courses":
            return { update: mockCourseUpdate };
          default:
            return {};
        }
      });

      return { mockCourseUpdate, mockCourseEq };
    }

    it("unpublishes a course with no enrolments", async () => {
      const { mockCourseUpdate, mockCourseEq } = wireUnpublishMocks({
        enrolmentCount: 0,
      });

      const result = await unpublishCourse("course-001");

      expect(result).toEqual({ success: true, error: null });
      expect(mockCourseUpdate).toHaveBeenCalledWith({
        status: "draft",
        is_active: false,
        updated_by: "admin-123",
      });
      expect(mockCourseEq).toHaveBeenCalledWith("id", "course-001");
      expect(revalidatePath).toHaveBeenCalledWith("/learning/admin/courses");
      expect(revalidatePath).toHaveBeenCalledWith("/learning/admin/courses/course-001");
      expect(revalidatePath).toHaveBeenCalledWith("/learning/courses");
      expect(revalidatePath).toHaveBeenCalledWith("/learning");
    });

    it("blocks unpublish when learners are enrolled (singular)", async () => {
      wireUnpublishMocks({ enrolmentCount: 1 });

      const result = await unpublishCourse("course-001");

      expect(result).toEqual({
        success: false,
        error: "Cannot revert to draft: 1 learner enrolled. Deactivate instead.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("blocks unpublish when multiple learners are enrolled (plural)", async () => {
      wireUnpublishMocks({ enrolmentCount: 5 });

      const result = await unpublishCourse("course-001");

      expect(result).toEqual({
        success: false,
        error: "Cannot revert to draft: 5 learners enrolled. Deactivate instead.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("allows unpublish when enrolment count is null (no enrolments table rows)", async () => {
      wireUnpublishMocks({ enrolmentCount: null });

      const result = await unpublishCourse("course-001");

      expect(result).toEqual({ success: true, error: null });
    });

    it("returns error when DB update fails", async () => {
      wireUnpublishMocks({
        enrolmentCount: 0,
        updateError: { message: "Update failed" },
      });

      const result = await unpublishCourse("course-001");

      expect(result).toEqual({ success: false, error: "Failed to unpublish course. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("throws when user is not authenticated", async () => {
      vi.mocked(requireLDAdmin).mockRejectedValue(
        new Error("Not authenticated")
      );

      await expect(unpublishCourse("course-001")).rejects.toThrow(
        "Not authenticated"
      );
    });

    it("throws when user is not an L&D admin", async () => {
      vi.mocked(requireLDAdmin).mockRejectedValue(
        new Error("Unauthorised: L&D admin access required")
      );

      await expect(unpublishCourse("course-001")).rejects.toThrow(
        "Unauthorised: L&D admin access required"
      );
    });
  });
});
