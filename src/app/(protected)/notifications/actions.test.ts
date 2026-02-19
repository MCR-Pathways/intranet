import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock strategy: Mock getCurrentUser() from @/lib/auth instead of
 * the low-level Supabase client. This matches the CLAUDE.md pattern.
 */

const mockEq = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockOrder = vi.hoisted(() => vi.fn());
const mockLimit = vi.hoisted(() => vi.fn());
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
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/(protected)/notifications/actions";
import { getCurrentUser } from "@/lib/auth";

const mockNotifications = [
  { id: "n1", user_id: "user-1", type: "course_published", title: "New Course", message: "Check it out", link: "/learning", is_read: false, read_at: null, created_at: "2026-01-15T10:00:00Z" },
  { id: "n2", user_id: "user-1", type: "sign_in_reminder", title: "Sign In", message: "Remember to sign in", link: "/sign-in", is_read: true, read_at: "2026-01-14T12:00:00Z", created_at: "2026-01-14T09:00:00Z" },
];

describe("Notification Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated user
    vi.mocked(getCurrentUser).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "user-1", email: "test@mcrpathways.org" } as never,
      profile: { id: "user-1" } as never,
    });

    // Wire select chain: .from().select().eq().order().limit()
    mockLimit.mockResolvedValue({ data: mockNotifications, error: null });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });

    // Wire update chain: .from().update().eq().eq()
    mockUpdate.mockReturnValue({ eq: mockEq });

    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
  });

  // ===========================================
  // getNotifications
  // ===========================================

  describe("getNotifications", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null,
        profile: null,
      });

      const result = await getNotifications();

      expect(result).toEqual({ notifications: [], error: "Not authenticated" });
    });

    it("returns 20 most recent notifications on success", async () => {
      const result = await getNotifications();

      expect(result).toEqual({ notifications: mockNotifications, error: null });
      expect(mockFrom).toHaveBeenCalledWith("notifications");
      expect(mockSelect).toHaveBeenCalledWith(
        "id, user_id, type, title, message, link, is_read, read_at, created_at"
      );
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
      expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(20);
    });

    it("returns empty array with error on DB failure", async () => {
      mockLimit.mockResolvedValue({
        data: null,
        error: { message: "Database connection error" },
      });

      const result = await getNotifications();

      expect(result).toEqual({
        notifications: [],
        error: "Database connection error",
      });
    });

    it("returns empty array when data is null", async () => {
      mockLimit.mockResolvedValue({ data: null, error: null });

      const result = await getNotifications();

      expect(result).toEqual({ notifications: [], error: null });
    });
  });

  // ===========================================
  // markNotificationRead
  // ===========================================

  describe("markNotificationRead", () => {
    beforeEach(() => {
      // For update chain: .from().update().eq().eq() → terminal
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });
    });

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null,
        profile: null,
      });

      const result = await markNotificationRead("n1");

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("updates notification with is_read and read_at", async () => {
      const result = await markNotificationRead("n1");

      expect(result).toEqual({ success: true, error: null });
      expect(mockFrom).toHaveBeenCalledWith("notifications");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_read: true,
          read_at: expect.any(String),
        })
      );
      expect(mockEq).toHaveBeenCalledWith("id", "n1");
    });

    it("returns error on DB failure", async () => {
      const mockEq2 = vi
        .fn()
        .mockResolvedValue({ error: { message: "Update failed" } });
      mockEq.mockReturnValue({ eq: mockEq2 });

      const result = await markNotificationRead("n1");

      expect(result).toEqual({ success: false, error: "Update failed" });
    });
  });

  // ===========================================
  // markAllNotificationsRead
  // ===========================================

  describe("markAllNotificationsRead", () => {
    beforeEach(() => {
      // For update chain: .from().update().eq().eq() → terminal
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });
    });

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null,
        profile: null,
      });

      const result = await markAllNotificationsRead();

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("updates all unread notifications for the user", async () => {
      const result = await markAllNotificationsRead();

      expect(result).toEqual({ success: true, error: null });
      expect(mockFrom).toHaveBeenCalledWith("notifications");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_read: true,
          read_at: expect.any(String),
        })
      );
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
    });

    it("returns error on DB failure", async () => {
      const mockEq2 = vi
        .fn()
        .mockResolvedValue({ error: { message: "Bulk update failed" } });
      mockEq.mockReturnValue({ eq: mockEq2 });

      const result = await markAllNotificationsRead();

      expect(result).toEqual({ success: false, error: "Bulk update failed" });
    });
  });
});
