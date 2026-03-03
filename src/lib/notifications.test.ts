/**
 * Tests for notification helper functions (service role client).
 *
 * These functions use the service role Supabase client to bypass RLS
 * for system operations like creating notifications and dismissing reminders.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockFrom, mockServiceClient } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockServiceClient = { from: mockFrom };
  return { mockFrom, mockServiceClient };
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => mockServiceClient),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chainable() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.insert = vi.fn().mockImplementation(self);
  chain.delete = vi.fn().mockImplementation(self);
  chain.eq = vi.fn().mockImplementation(self);
  return chain;
}

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { createNotification, dismissSignInReminders } from "./notifications";

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Notification Helpers", () => {
  // =============================================
  // createNotification
  // =============================================

  describe("createNotification", () => {
    it("creates a notification with all fields", async () => {
      const c = chainable();
      c.insert.mockResolvedValue({ error: null });
      mockFrom.mockReturnValue(c);

      const result = await createNotification({
        userId: "user-1",
        type: "course_published",
        title: "New Course",
        message: "A new course is available",
        link: "/learning/courses/123",
        metadata: { courseId: "123" },
      });

      expect(result.error).toBeNull();
      expect(mockFrom).toHaveBeenCalledWith("notifications");
      expect(c.insert).toHaveBeenCalledWith({
        user_id: "user-1",
        type: "course_published",
        title: "New Course",
        message: "A new course is available",
        link: "/learning/courses/123",
        metadata: { courseId: "123" },
      });
    });

    it("defaults link and metadata to null when not provided", async () => {
      const c = chainable();
      c.insert.mockResolvedValue({ error: null });
      mockFrom.mockReturnValue(c);

      const result = await createNotification({
        userId: "user-1",
        type: "sign_in_reminder",
        title: "Sign In",
        message: "Remember to sign in today",
      });

      expect(result.error).toBeNull();
      expect(c.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          link: null,
          metadata: null,
        }),
      );
    });

    it("returns error on DB failure", async () => {
      const c = chainable();
      c.insert.mockResolvedValue({ error: { message: "Insert failed" } });
      mockFrom.mockReturnValue(c);

      const result = await createNotification({
        userId: "user-1",
        type: "test",
        title: "Test",
        message: "Test",
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Insert failed");
    });
  });

  // =============================================
  // dismissSignInReminders
  // =============================================

  describe("dismissSignInReminders", () => {
    it("deletes all sign_in_reminder notifications for user", async () => {
      const secondEq = vi.fn().mockResolvedValue({ error: null });
      const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
      const mockDelete = vi.fn().mockReturnValue({ eq: firstEq });
      mockFrom.mockReturnValue({ delete: mockDelete });

      const result = await dismissSignInReminders("user-1");

      expect(result.error).toBeNull();
      expect(mockFrom).toHaveBeenCalledWith("notifications");
      expect(firstEq).toHaveBeenCalledWith("user_id", "user-1");
      expect(secondEq).toHaveBeenCalledWith("type", "sign_in_reminder");
    });

    it("returns error on DB failure", async () => {
      const secondEq = vi.fn().mockResolvedValue({ error: { message: "Delete failed" } });
      const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
      const mockDelete = vi.fn().mockReturnValue({ eq: firstEq });
      mockFrom.mockReturnValue({ delete: mockDelete });

      const result = await dismissSignInReminders("user-1");

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Delete failed");
    });
  });
});
