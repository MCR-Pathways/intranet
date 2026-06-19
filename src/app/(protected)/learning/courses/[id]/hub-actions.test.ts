import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock strategy: mock getCurrentUser() from @/lib/auth instead of the
 * low-level Supabase client, per the CLAUDE.md pattern. completeHubCourse and
 * ensureHubEnrolment touch two tables (courses for the source check, then
 * course_enrolments for the select/update/insert), so the `from` mock dispatches
 * by table name and returns the methods each branch needs. sendCompletionEmails
 * is mocked so we can assert it fires without reaching the email queue.
 */

const mockCoursesSingle = vi.hoisted(() => vi.fn());
const mockEnrolmentSingle = vi.hoisted(() => vi.fn());
const mockEnrolmentUpdateEq2 = vi.hoisted(() => vi.fn());
const mockEnrolmentUpdate = vi.hoisted(() => vi.fn());
const mockEnrolmentInsert = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

const mockSupabase = vi.hoisted(() => ({
  from: mockFrom,
}));

const mockSendCompletionEmails = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    supabase: mockSupabase,
    user: { id: "user-1", email: "test@mcrpathways.org" },
    profile: { id: "user-1" },
  }),
}));

vi.mock("@/lib/learning/completion-emails", () => ({
  sendCompletionEmails: mockSendCompletionEmails,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  completeHubCourse,
  ensureHubEnrolment,
} from "@/app/(protected)/learning/courses/[id]/hub-actions";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Wire the `from` dispatcher.
 *  - "courses":           .select().eq().single() → mockCoursesSingle
 *  - "course_enrolments": .select().eq().eq().maybeSingle() → mockEnrolmentSingle
 *                         .update().eq().eq()          → mockEnrolmentUpdateEq2
 *                         .insert()                    → mockEnrolmentInsert
 */
function wireFrom() {
  mockEnrolmentUpdate.mockReturnValue({
    eq: () => ({ eq: mockEnrolmentUpdateEq2 }),
  });

  mockFrom.mockImplementation((table: string) => {
    if (table === "courses") {
      return {
        select: () => ({
          eq: () => ({ single: mockCoursesSingle }),
        }),
      };
    }
    if (table === "course_enrolments") {
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: mockEnrolmentSingle }) }),
        }),
        update: mockEnrolmentUpdate,
        insert: mockEnrolmentInsert,
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
}

describe("hub-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getCurrentUser).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "user-1", email: "test@mcrpathways.org" } as never,
      profile: { id: "user-1" } as never,
    });

    // Defaults: hub course, no existing enrolment, writes succeed.
    mockCoursesSingle.mockResolvedValue({
      data: { id: "course-1", source: "hub" },
      error: null,
    });
    mockEnrolmentSingle.mockResolvedValue({ data: null, error: null });
    mockEnrolmentUpdateEq2.mockResolvedValue({ error: null });
    mockEnrolmentInsert.mockResolvedValue({ error: null });

    wireFrom();
  });

  describe("completeHubCourse", () => {
    it("updates an existing enrolment to completed with progress 100 and a clamped score, then sends emails", async () => {
      mockEnrolmentSingle.mockResolvedValue({
        data: { id: "enrol-1" },
        error: null,
      });

      const result = await completeHubCourse("course-1", 87);

      expect(result).toEqual({ success: true, error: null });
      expect(mockEnrolmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          progress_percent: 100,
          score: 87,
          completed_at: expect.any(String),
        })
      );
      expect(mockEnrolmentInsert).not.toHaveBeenCalled();
      expect(mockSendCompletionEmails).toHaveBeenCalledWith("user-1", "course-1");
      expect(revalidatePath).toHaveBeenCalledWith("/learning/courses/course-1");
      expect(revalidatePath).toHaveBeenCalledWith("/learning");
    });

    it("inserts a completed enrolment when none exists", async () => {
      const result = await completeHubCourse("course-1", 50);

      expect(result).toEqual({ success: true, error: null });
      expect(mockEnrolmentInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-1",
          course_id: "course-1",
          status: "completed",
          progress_percent: 100,
          score: 50,
          completed_at: expect.any(String),
        })
      );
      expect(mockEnrolmentUpdateEq2).not.toHaveBeenCalled();
      expect(mockSendCompletionEmails).toHaveBeenCalledWith("user-1", "course-1");
    });

    it("returns an error when the course is not source='hub'", async () => {
      mockCoursesSingle.mockResolvedValue({
        data: { id: "course-1", source: "native" },
        error: null,
      });

      const result = await completeHubCourse("course-1", 90);

      expect(result).toEqual({ success: false, error: "Course not found" });
      expect(mockEnrolmentUpdate).not.toHaveBeenCalled();
      expect(mockEnrolmentInsert).not.toHaveBeenCalled();
      expect(mockSendCompletionEmails).not.toHaveBeenCalled();
    });

    it("clamps an above-range score down to 100", async () => {
      mockEnrolmentSingle.mockResolvedValue({
        data: { id: "enrol-1" },
        error: null,
      });

      await completeHubCourse("course-1", 150);

      expect(mockEnrolmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ score: 100 })
      );
    });

    it("clamps a below-range score up to 0", async () => {
      mockEnrolmentSingle.mockResolvedValue({
        data: { id: "enrol-1" },
        error: null,
      });

      await completeHubCourse("course-1", -20);

      expect(mockEnrolmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ score: 0 })
      );
    });

    it("returns Not authenticated when there is no user", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null,
        profile: null,
      });

      const result = await completeHubCourse("course-1", 80);

      expect(result).toEqual({ success: false, error: "Not authenticated" });
      expect(mockSendCompletionEmails).not.toHaveBeenCalled();
    });

    it("returns a generic error and does not send emails when the update fails", async () => {
      mockEnrolmentSingle.mockResolvedValue({
        data: { id: "enrol-1" },
        error: null,
      });
      mockEnrolmentUpdateEq2.mockResolvedValue({
        error: { message: "constraint violation" },
      });

      const result = await completeHubCourse("course-1", 80);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to complete course");
      expect(mockSendCompletionEmails).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("ensureHubEnrolment", () => {
    it("inserts an in_progress enrolment when none exists", async () => {
      await ensureHubEnrolment("course-1");

      expect(mockEnrolmentInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-1",
          course_id: "course-1",
          status: "in_progress",
          progress_percent: 0,
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/learning/courses/course-1");
    });

    it("does nothing when an enrolment already exists", async () => {
      mockEnrolmentSingle.mockResolvedValue({
        data: { id: "enrol-1", status: "completed" },
        error: null,
      });

      await ensureHubEnrolment("course-1");

      expect(mockEnrolmentInsert).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("does nothing for a non-hub course", async () => {
      mockCoursesSingle.mockResolvedValue({
        data: { id: "course-1", source: "native" },
        error: null,
      });

      await ensureHubEnrolment("course-1");

      expect(mockEnrolmentInsert).not.toHaveBeenCalled();
    });
  });
});
