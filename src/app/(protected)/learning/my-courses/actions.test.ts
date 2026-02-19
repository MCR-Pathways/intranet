import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock strategy for external course actions:
 * - All actions use createClient() → supabase.auth.getUser() for auth
 * - Then supabase.from("external_courses").insert/update/delete chains
 *
 * We mock createClient to control auth and DB responses.
 */

const mockInsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockGetUserAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUserAuth() },
    from: mockFrom,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  addExternalCourse,
  updateExternalCourse,
} from "@/app/(protected)/learning/my-courses/actions";

describe("External Course Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated user
    mockGetUserAuth.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    // Default: DB operations succeed
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert, update: mockUpdate });
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
      // For update, the chain is .from().update().eq().eq()
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockUpdate.mockReturnValue({ eq: mockEq });

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
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockUpdate.mockReturnValue({ eq: mockEq });

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
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockUpdate.mockReturnValue({ eq: mockEq });

      const result = await updateExternalCourse("course-1", {
        title: "",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Title is required");
    });

    it("rejects whitespace-only title on update", async () => {
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockUpdate.mockReturnValue({ eq: mockEq });

      const result = await updateExternalCourse("course-1", {
        title: "   ",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Title is required");
    });

    it("accepts valid title on update", async () => {
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockUpdate.mockReturnValue({ eq: mockEq });

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
    it("throws when not authenticated on add", async () => {
      mockGetUserAuth.mockResolvedValue({ data: { user: null } });

      await expect(
        addExternalCourse({
          title: "Test",
          completed_at: "2026-01-01",
        })
      ).rejects.toThrow("Not authenticated");
    });

    it("throws when not authenticated on update", async () => {
      mockGetUserAuth.mockResolvedValue({ data: { user: null } });

      await expect(
        updateExternalCourse("course-1", { title: "Test" })
      ).rejects.toThrow("Not authenticated");
    });
  });
});
