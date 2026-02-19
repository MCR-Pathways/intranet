import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock strategy: Mock getCurrentUser() from @/lib/auth instead of
 * the low-level Supabase client. This matches the CLAUDE.md pattern.
 */

const mockEq = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

const mockSupabase = vi.hoisted(() => ({
  from: mockFrom,
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
  addExternalCourse,
  updateExternalCourse,
  deleteExternalCourse,
} from "@/app/(protected)/learning/my-courses/actions";
import { getCurrentUser } from "@/lib/auth";

describe("External Course Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated user
    vi.mocked(getCurrentUser).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "user-1", email: "test@mcrpathways.org" } as never,
      profile: { id: "user-1" } as never,
    });

    // Default: DB insert succeeds
    mockInsert.mockResolvedValue({ error: null });

    // Default: DB update chain: .from().update().eq().eq()
    const mockEq2 = vi.fn().mockResolvedValue({ error: null });
    mockEq.mockReturnValue({ eq: mockEq2 });
    mockUpdate.mockReturnValue({ eq: mockEq });

    // Default: DB delete chain: .from().delete().eq().eq()
    mockDelete.mockReturnValue({ eq: mockEq });

    mockFrom.mockReturnValue({
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    });
  });

  // ===========================================
  // KG-01: certificate_url protocol validation
  // ===========================================

  describe("certificate_url validation (KG-01)", () => {
    it("rejects javascript: protocol on add", async () => {
      const result = await addExternalCourse({
        title: "Test Course",
        completed_at: "2026-01-01",
        certificate_url: "javascript:alert('xss')",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("must use https:// or http://");
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("rejects data: protocol on add", async () => {
      const result = await addExternalCourse({
        title: "Test Course",
        completed_at: "2026-01-01",
        certificate_url: "data:text/html,<script>alert(1)</script>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("must use https:// or http://");
    });

    it("rejects ftp: protocol on add", async () => {
      const result = await addExternalCourse({
        title: "Test Course",
        completed_at: "2026-01-01",
        certificate_url: "ftp://evil.com/cert.pdf",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("must use https:// or http://");
    });

    it("rejects malformed URL on add", async () => {
      const result = await addExternalCourse({
        title: "Test Course",
        completed_at: "2026-01-01",
        certificate_url: "not-a-valid-url",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid Certificate URL");
    });

    it("accepts https:// URL on add", async () => {
      const result = await addExternalCourse({
        title: "Test Course",
        completed_at: "2026-01-01",
        certificate_url: "https://example.com/cert.pdf",
      });

      expect(result.success).toBe(true);
    });

    it("accepts http:// URL on add", async () => {
      const result = await addExternalCourse({
        title: "Test Course",
        completed_at: "2026-01-01",
        certificate_url: "http://example.com/cert.pdf",
      });

      expect(result.success).toBe(true);
    });

    it("allows null/empty certificate_url on add", async () => {
      const result = await addExternalCourse({
        title: "Test Course",
        completed_at: "2026-01-01",
        certificate_url: null,
      });

      expect(result.success).toBe(true);
    });

    it("rejects javascript: protocol on update", async () => {
      const result = await updateExternalCourse("course-1", {
        certificate_url: "javascript:alert('xss')",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("must use https:// or http://");
    });
  });

  // ===========================================
  // KG-02: duration_minutes validation
  // ===========================================

  describe("duration_minutes validation (KG-02)", () => {
    it("rejects negative duration on add", async () => {
      const result = await addExternalCourse({
        title: "Test Course",
        completed_at: "2026-01-01",
        duration_minutes: -5,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Duration must be at least 1 minute");
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("rejects zero duration on add", async () => {
      const result = await addExternalCourse({
        title: "Test Course",
        completed_at: "2026-01-01",
        duration_minutes: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Duration must be at least 1 minute");
    });

    it("accepts positive duration on add", async () => {
      const result = await addExternalCourse({
        title: "Test Course",
        completed_at: "2026-01-01",
        duration_minutes: 30,
      });

      expect(result.success).toBe(true);
    });

    it("allows null duration on add", async () => {
      const result = await addExternalCourse({
        title: "Test Course",
        completed_at: "2026-01-01",
        duration_minutes: null,
      });

      expect(result.success).toBe(true);
    });

    it("rejects negative duration on update", async () => {
      const result = await updateExternalCourse("course-1", {
        duration_minutes: -10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Duration must be at least 1 minute");
    });
  });

  // ===========================================
  // KG-03: empty title on update
  // ===========================================

  describe("empty title on update (KG-03)", () => {
    it("rejects empty title on update", async () => {
      const result = await updateExternalCourse("course-1", {
        title: "",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Title is required");
    });

    it("rejects whitespace-only title on update", async () => {
      const result = await updateExternalCourse("course-1", {
        title: "   ",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Title is required");
    });

    it("accepts valid title on update", async () => {
      const result = await updateExternalCourse("course-1", {
        title: "Valid Title",
      });

      expect(result.success).toBe(true);
    });
  });

  // ===========================================
  // Auth checks
  // ===========================================

  describe("authentication", () => {
    it("returns error when not authenticated on add", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null,
        profile: null,
      });

      const result = await addExternalCourse({
        title: "Test",
        completed_at: "2026-01-01",
      });

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when not authenticated on update", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null,
        profile: null,
      });

      const result = await updateExternalCourse("course-1", { title: "Test" });

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when not authenticated on delete", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null,
        profile: null,
      });

      const result = await deleteExternalCourse("course-1");

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });
  });
});
