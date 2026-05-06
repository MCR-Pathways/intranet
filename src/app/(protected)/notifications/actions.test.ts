import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock strategy: mock getCurrentUser() from @/lib/auth instead of the
 * low-level Supabase client. Persistent-attention is mocked at module
 * boundary so getInboxStream tests are isolated from the underlying
 * state-compute helpers.
 *
 * Chain shape for the read path (inside getInboxStream):
 *   from().select().eq("user_id").eq("is_cleared").order().limit()
 *
 * Chain shape for clear actions:
 *   from().update().eq().eq()
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

vi.mock("@/lib/persistent-attention", () => ({
  getAllPersistentAttention: vi.fn().mockResolvedValue([]),
}));

import {
  getInboxStream,
  clearNotification,
  clearAllNotifications,
} from "@/app/(protected)/notifications/actions";
import { getCurrentUser } from "@/lib/auth";
import { getAllPersistentAttention } from "@/lib/persistent-attention";
import { revalidatePath } from "next/cache";

const NOTIF_ROW_BASE = {
  user_id: "user-1",
  is_read: false,
  read_at: null,
  is_cleared: false,
  cleared_at: null,
};

const mockNotifications = [
  {
    id: "n1",
    type: "course_published",
    title: "New Course",
    message: "Check it out",
    link: "/learning",
    created_at: "2026-01-15T10:00:00Z",
    source_kind: null,
    source_id: null,
    ...NOTIF_ROW_BASE,
  },
  {
    id: "n2",
    type: "sign_in_reminder",
    title: "Sign In",
    message: "Remember to sign in",
    link: "/sign-in",
    created_at: "2026-01-14T09:00:00Z",
    source_kind: null,
    source_id: null,
    ...NOTIF_ROW_BASE,
  },
];

describe("Notification Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getCurrentUser).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "user-1", email: "test@mcrpathways.org" } as never,
      profile: { id: "user-1" } as never,
    });

    vi.mocked(getAllPersistentAttention).mockResolvedValue([]);

    // Select chain: from().select().eq("user_id").eq("is_cleared").order().limit()
    mockLimit.mockResolvedValue({ data: mockNotifications, error: null });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockEq.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });

    // Update chain: from().update().eq().eq()
    mockUpdate.mockReturnValue({ eq: mockEq });

    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
  });

  // ===========================================
  // getInboxStream
  // ===========================================

  describe("getInboxStream", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null,
        profile: null,
      });

      const result = await getInboxStream();
      expect(result).toEqual({ rows: [], error: "Not authenticated" });
    });

    it("queries notifications with the is_cleared filter and overfetch limit", async () => {
      await getInboxStream();

      expect(mockFrom).toHaveBeenCalledWith("notifications");
      expect(mockSelect).toHaveBeenCalledWith(
        "id, user_id, type, title, message, link, is_read, read_at, created_at, source_kind, source_id, is_cleared, cleared_at",
      );
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
      expect(mockEq).toHaveBeenCalledWith("is_cleared", false);
      expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(50);
    });

    it("returns event-kind rows from DB notifications", async () => {
      const result = await getInboxStream();

      expect(result.error).toBeNull();
      expect(result.rows).toHaveLength(2);
      expect(result.rows.every((r) => r.kind === "event")).toBe(true);
    });

    it("dedupes by composite source_kind:source_id (newer wins)", async () => {
      const dupes = [
        { ...mockNotifications[0], id: "newer", source_kind: "leave_request", source_id: "lr-1", created_at: "2026-01-20T10:00:00Z" },
        { ...mockNotifications[0], id: "older", source_kind: "leave_request", source_id: "lr-1", created_at: "2026-01-19T10:00:00Z" },
        { ...mockNotifications[0], id: "different", source_kind: "leave_request", source_id: "lr-2", created_at: "2026-01-18T10:00:00Z" },
      ];
      mockLimit.mockResolvedValue({ data: dupes, error: null });

      const result = await getInboxStream();

      expect(result.rows.map((r) => r.id)).toEqual(["newer", "different"]);
    });

    it("does not dedupe rows without source_id", async () => {
      const noSource = [
        { ...mockNotifications[0], id: "a", source_id: null },
        { ...mockNotifications[0], id: "b", source_id: null },
      ];
      mockLimit.mockResolvedValue({ data: noSource, error: null });

      const result = await getInboxStream();
      expect(result.rows.map((r) => r.id)).toEqual(["a", "b"]);
    });

    it("returns empty rows with error on DB failure", async () => {
      mockLimit.mockResolvedValue({
        data: null,
        error: { message: "Database connection error" },
      });

      const result = await getInboxStream();
      expect(result.rows).toEqual([]);
      expect(result.error).toContain("Failed to fetch notifications");
    });

    it("merges DB rows and persistent-state rows, sorted by created_at desc", async () => {
      vi.mocked(getAllPersistentAttention).mockResolvedValue([
        {
          id: "state:foo:user-1",
          kind: "state",
          source_kind: "compliance_assignment",
          source_id: "user-1",
          type: "compliance_overdue",
          title: "1 compliance document needs attention",
          message: "msg",
          link: "/hr/compliance",
          created_at: "2026-01-16T00:00:00Z", // newer than mockNotifications[0]
          is_cleared: false,
          reason: "Compliance",
          count: 1,
        },
      ]);

      const result = await getInboxStream();

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].kind).toBe("state");
      expect(result.rows[1].id).toBe("n1");
      expect(result.rows[2].id).toBe("n2");
    });

    it("populates reason label from source_kind on event rows", async () => {
      mockLimit.mockResolvedValue({
        data: [
          { ...mockNotifications[0], source_kind: "leave_request", source_id: "lr-1" },
        ],
        error: null,
      });

      const result = await getInboxStream();
      expect(result.rows[0].reason).toBe("Leave request");
    });

    it("leaves reason empty when source_kind is missing (UI hides the pill)", async () => {
      const result = await getInboxStream();
      expect(result.rows[0].reason).toBe("");
    });
  });

  // ===========================================
  // clearNotification
  // ===========================================

  describe("clearNotification", () => {
    beforeEach(() => {
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });
    });

    it("flips is_cleared to true with cleared_at timestamp", async () => {
      const result = await clearNotification("n1");

      expect(result).toEqual({ success: true, error: null });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_cleared: true,
          cleared_at: expect.any(String),
        }),
      );
      expect(mockEq).toHaveBeenCalledWith("id", "n1");
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    });

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null,
        profile: null,
      });

      const result = await clearNotification("n1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });

    it("returns error on DB failure", async () => {
      const mockEq2 = vi.fn().mockResolvedValue({ error: { message: "fail" } });
      mockEq.mockReturnValue({ eq: mockEq2 });

      const result = await clearNotification("n1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to clear notification");
    });
  });

  // ===========================================
  // clearAllNotifications
  // ===========================================

  describe("clearAllNotifications", () => {
    beforeEach(() => {
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });
    });

    it("flips every uncleared row for the current user", async () => {
      const result = await clearAllNotifications();

      expect(result).toEqual({ success: true, error: null });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_cleared: true,
          cleared_at: expect.any(String),
        }),
      );
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    });

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null,
        profile: null,
      });

      const result = await clearAllNotifications();
      expect(result.success).toBe(false);
    });

    it("returns error on DB failure", async () => {
      const mockEq2 = vi.fn().mockResolvedValue({ error: { message: "fail" } });
      mockEq.mockReturnValue({ eq: mockEq2 });

      const result = await clearAllNotifications();
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to clear notifications");
    });
  });
});
