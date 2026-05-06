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

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { autoClearSource, createNotification, createNotifications, markSourceCleared, NOTIFICATION_SOURCE_KINDS } from "./notifications";

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
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ insert: insertMock });

      const result = await createNotification({
        userId: "user-1",
        type: "course_published",
        title: "New Course",
        message: "A new course is available",
        link: "/learning/courses/123",
        metadata: { courseId: "123" },
        sourceKind: NOTIFICATION_SOURCE_KINDS.COURSE_ASSIGNMENT,
        sourceId: "assign-123",
      });

      expect(result.error).toBeNull();
      expect(mockFrom).toHaveBeenCalledWith("notifications");
      expect(insertMock).toHaveBeenCalledWith({
        user_id: "user-1",
        type: "course_published",
        title: "New Course",
        message: "A new course is available",
        link: "/learning/courses/123",
        metadata: { courseId: "123" },
        source_kind: "course_assignment",
        source_id: "assign-123",
      });
    });

    it("defaults link and metadata to null when not provided", async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ insert: insertMock });

      const result = await createNotification({
        userId: "user-1",
        type: "sign_in_reminder",
        title: "Sign In",
        message: "Remember to sign in today",
        sourceKind: NOTIFICATION_SOURCE_KINDS.RTW_FORM,
        sourceId: "rtw-1",
      });

      expect(result.error).toBeNull();
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          link: null,
          metadata: null,
        }),
      );
    });

    it("returns error on DB failure", async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: { message: "Insert failed" } });
      mockFrom.mockReturnValue({ insert: insertMock });

      const result = await createNotification({
        userId: "user-1",
        type: "test",
        title: "Test",
        message: "Test",
        sourceKind: NOTIFICATION_SOURCE_KINDS.LEAVE_REQUEST,
        sourceId: "lr-1",
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Insert failed");
    });
  });

  // =============================================
  // createNotifications (batch)
  // =============================================

  describe("createNotifications", () => {
    it("inserts a batch of rows in a single call", async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ insert: insertMock });

      const result = await createNotifications([
        {
          userId: "user-1",
          type: "fwr_submitted",
          title: "FWR",
          message: "msg",
          sourceKind: NOTIFICATION_SOURCE_KINDS.FLEXIBLE_WORKING_REQUEST,
          sourceId: "fwr-1",
        },
        {
          userId: "user-2",
          type: "fwr_submitted",
          title: "FWR",
          message: "msg",
          sourceKind: NOTIFICATION_SOURCE_KINDS.FLEXIBLE_WORKING_REQUEST,
          sourceId: "fwr-1",
        },
      ]);

      expect(result.error).toBeNull();
      expect(insertMock).toHaveBeenCalledTimes(1);
      const insertedRows = insertMock.mock.calls[0][0];
      expect(insertedRows).toHaveLength(2);
      expect(insertedRows[0]).toMatchObject({
        user_id: "user-1",
        source_kind: "flexible_working_request",
        source_id: "fwr-1",
      });
    });

    it("no-ops on empty array without calling Supabase", async () => {
      const result = await createNotifications([]);
      expect(result.error).toBeNull();
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns error on DB failure", async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: { message: "Batch insert failed" } });
      mockFrom.mockReturnValue({ insert: insertMock });

      const result = await createNotifications([
        {
          userId: "user-1",
          type: "test",
          title: "Test",
          message: "Test",
          sourceKind: NOTIFICATION_SOURCE_KINDS.LEAVE_REQUEST,
          sourceId: "lr-1",
        },
      ]);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Batch insert failed");
    });
  });

  // =============================================
  // markSourceCleared
  // =============================================

  describe("markSourceCleared", () => {
    function setupClearChain(opts?: { error?: { message: string } }) {
      const eqIsCleared = vi.fn().mockResolvedValue({ error: opts?.error ?? null });
      const eqSourceId = vi.fn().mockReturnValue({ eq: eqIsCleared });
      const eqSourceKind = vi.fn().mockReturnValue({ eq: eqSourceId });
      const update = vi.fn().mockReturnValue({ eq: eqSourceKind });
      mockFrom.mockReturnValue({ update });
      return { update, eqSourceKind, eqSourceId, eqIsCleared };
    }

    it("flips matching rows to is_cleared = true and stamps cleared_at", async () => {
      const chain = setupClearChain();

      const result = await markSourceCleared(
        NOTIFICATION_SOURCE_KINDS.LEAVE_REQUEST,
        "leave-1",
      );

      expect(result.error).toBeNull();
      expect(mockFrom).toHaveBeenCalledWith("notifications");
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_cleared: true,
          cleared_at: expect.any(String),
        }),
      );
      expect(chain.eqSourceKind).toHaveBeenCalledWith("source_kind", "leave_request");
      expect(chain.eqSourceId).toHaveBeenCalledWith("source_id", "leave-1");
      expect(chain.eqIsCleared).toHaveBeenCalledWith("is_cleared", false);
    });

    it("returns error on DB failure", async () => {
      setupClearChain({ error: { message: "Update failed" } });

      const result = await markSourceCleared(
        NOTIFICATION_SOURCE_KINDS.RTW_FORM,
        "rtw-1",
      );

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Update failed");
    });
  });

  // =============================================
  // autoClearSource
  // =============================================

  describe("autoClearSource", () => {
    function setupClearChain(opts?: { error?: { message: string } }) {
      const eqIsCleared = vi.fn().mockResolvedValue({ error: opts?.error ?? null });
      const eqSourceId = vi.fn().mockReturnValue({ eq: eqIsCleared });
      const eqSourceKind = vi.fn().mockReturnValue({ eq: eqSourceId });
      const update = vi.fn().mockReturnValue({ eq: eqSourceKind });
      mockFrom.mockReturnValue({ update });
    }

    it("returns void on success", async () => {
      setupClearChain();

      const result = await autoClearSource(
        NOTIFICATION_SOURCE_KINDS.FLEXIBLE_WORKING_REQUEST,
        "fwr-1",
      );

      expect(result).toBeUndefined();
    });

    it("swallows returned errors and never throws", async () => {
      setupClearChain({ error: { message: "DB error" } });

      await expect(
        autoClearSource(NOTIFICATION_SOURCE_KINDS.RTW_FORM, "rtw-1"),
      ).resolves.toBeUndefined();
    });

    it("swallows thrown exceptions and never throws", async () => {
      mockFrom.mockImplementation(() => {
        throw new Error("Service client misconfigured");
      });

      await expect(
        autoClearSource(NOTIFICATION_SOURCE_KINDS.LEAVE_REQUEST, "lr-1"),
      ).resolves.toBeUndefined();
    });
  });
});
