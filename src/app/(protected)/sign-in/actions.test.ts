import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Helper: get today's date in UK timezone (mirrors getUKToday() in actions.ts)
 */
function getUKToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

/**
 * Mock strategy for sign-in actions:
 * - recordSignIn uses createClient() directly (for insert + profile update)
 * - Read actions use getCurrentUser() from @/lib/auth
 * - checkAndCreateSignInNudge uses getCurrentUser() + createNotification from @/lib/notifications
 *
 * We mock both to control auth state and database responses.
 */

const mockInsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockLimit = vi.hoisted(() => vi.fn());
const mockOrder = vi.hoisted(() => vi.fn());

const mockGetUserAuth = vi.hoisted(() => vi.fn());

// Mock createClient for recordSignIn / deleteSignInEntry
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUserAuth() },
    from: mockFrom,
  }),
}));

// Mock getCurrentUser for read actions and nudge check
const mockGetCurrentUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock notifications
const mockCreateNotification = vi.hoisted(() => vi.fn());
const mockDismissSignInReminders = vi.hoisted(() => vi.fn());
vi.mock("@/lib/notifications", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
  dismissSignInReminders: (...args: unknown[]) => mockDismissSignInReminders(...args),
}));

import {
  recordSignIn,
  getTodaySignIns,
  getMonthlyHistory,
  deleteSignInEntry,
  getTeamSignInsToday,
  getTeamSignInHistory,
  checkAndCreateSignInNudge,
} from "@/app/(protected)/sign-in/actions";
import { revalidatePath } from "next/cache";

describe("Sign-in Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDismissSignInReminders.mockResolvedValue({ error: null });
    mockCreateNotification.mockResolvedValue({ error: null });
  });

  describe("recordSignIn", () => {
    beforeEach(() => {
      // Default: authenticated user
      mockGetUserAuth.mockResolvedValue({
        data: { user: { id: "user-1" } },
      });
      // Mock sign_ins select (checking existing today) -> returns empty (first of day)
      mockLimit.mockResolvedValue({ data: [] });
      mockEq.mockReturnValue({ limit: mockLimit });
      // Mock sign_ins insert -> success
      mockInsert.mockResolvedValue({ error: null });
      // Mock profiles update -> success
      mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

      mockFrom.mockImplementation((table: string) => {
        if (table === "sign_ins") {
          return {
            insert: mockInsert,
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: mockEq,
              }),
            }),
          };
        }
        if (table === "profiles") return { update: mockUpdate };
        return {};
      });
    });

    it("returns error when not authenticated", async () => {
      mockGetUserAuth.mockResolvedValue({ data: { user: null } });

      const result = await recordSignIn("home");
      expect(result).toEqual({
        success: false,
        error: "Not authenticated",
      });
    });

    it("rejects invalid location", async () => {
      const result = await recordSignIn("invalid_location");
      expect(result).toEqual({
        success: false,
        error: "Invalid location",
      });
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("requires other_location when location is 'other'", async () => {
      const result = await recordSignIn("other", "");
      expect(result).toEqual({
        success: false,
        error: "Please specify your location",
      });
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("records sign-in successfully via INSERT (not upsert)", async () => {
      const result = await recordSignIn("home");

      expect(result).toEqual({ success: true, error: null });
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-1",
          location: "home",
          other_location: null,
        })
      );
      // Verify it's a plain insert, not an upsert
      expect(mockInsert).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ onConflict: expect.anything() })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/sign-in");
    });

    it("records sign-in with 'other' location", async () => {
      const result = await recordSignIn("other", "Edinburgh Office");

      expect(result).toEqual({ success: true, error: null });
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          location: "other",
          other_location: "Edinburgh Office",
        })
      );
    });

    it("dismisses sign-in reminders on first entry of the day", async () => {
      // First of day (no existing entries)
      mockLimit.mockResolvedValue({ data: [] });

      await recordSignIn("home");

      expect(mockDismissSignInReminders).toHaveBeenCalledWith("user-1");
    });

    it("does not dismiss reminders on subsequent entries", async () => {
      // Not first of day (existing entry found)
      mockLimit.mockResolvedValue({ data: [{ id: "existing-1" }] });

      await recordSignIn("glasgow_office");

      expect(mockDismissSignInReminders).not.toHaveBeenCalled();
    });

    it("updates profiles.last_sign_in_date on first entry", async () => {
      mockLimit.mockResolvedValue({ data: [] });

      await recordSignIn("glasgow_office");

      expect(mockFrom).toHaveBeenCalledWith("profiles");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          last_sign_in_date: expect.any(String),
        })
      );
    });

    it("still succeeds when dismissSignInReminders throws", async () => {
      mockLimit.mockResolvedValue({ data: [] });
      mockDismissSignInReminders.mockRejectedValue(new Error("Network error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await recordSignIn("home");

      expect(result).toEqual({ success: true, error: null });
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to dismiss sign-in reminders:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it("returns error when insert fails", async () => {
      mockInsert.mockResolvedValue({
        error: { message: "Database error" },
      });

      const result = await recordSignIn("home");
      expect(result).toEqual({
        success: false,
        error: "Database error",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("truncates other_location to 200 characters", async () => {
      const longLocation = "A".repeat(300);
      await recordSignIn("other", longLocation);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          other_location: "A".repeat(200),
        })
      );
    });

    it("includes signed_in_at timestamp in the insert", async () => {
      await recordSignIn("home");

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          signed_in_at: expect.any(String),
        })
      );
    });
  });

  describe("getTodaySignIns", () => {
    it("returns empty array when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue({
        supabase: { from: mockFrom },
        user: null,
        profile: null,
      });

      const result = await getTodaySignIns();
      expect(result).toEqual([]);
    });

    it("returns array of today's sign-in records", async () => {
      const today = getUKToday();
      const signInData = [
        {
          id: "si-1",
          sign_in_date: today,
          location: "home",
          other_location: null,
          signed_in_at: "2024-01-01T09:00:00Z",
          created_at: "2024-01-01T09:00:00Z",
        },
        {
          id: "si-2",
          sign_in_date: today,
          location: "glasgow_office",
          other_location: null,
          signed_in_at: "2024-01-01T13:00:00Z",
          created_at: "2024-01-01T13:00:00Z",
        },
      ];

      // Chain: .from().select().eq("user_id").eq("sign_in_date").order()
      mockOrder.mockResolvedValue({ data: signInData });
      const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      mockGetCurrentUser.mockResolvedValue({
        supabase: { from: mockFrom },
        user: { id: "user-1" },
        profile: { user_type: "staff" },
      });

      const result = await getTodaySignIns();
      expect(result).toEqual(signInData);
      expect(result).toHaveLength(2);
    });
  });

  describe("getMonthlyHistory", () => {
    it("returns empty array when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue({
        supabase: { from: mockFrom },
        user: null,
        profile: null,
      });

      const result = await getMonthlyHistory();
      expect(result).toEqual([]);
    });
  });

  describe("deleteSignInEntry", () => {
    it("returns error when not authenticated", async () => {
      mockGetUserAuth.mockResolvedValue({ data: { user: null } });

      const result = await deleteSignInEntry("entry-1");
      expect(result).toEqual({
        success: false,
        error: "Not authenticated",
      });
    });

    it("deletes entry and clears last_sign_in_date when no entries remain", async () => {
      mockGetUserAuth.mockResolvedValue({
        data: { user: { id: "user-1" } },
      });

      // 1) delete chain: .from("sign_ins").delete().eq("id").eq("user_id")
      const mockDeleteEq2 = vi.fn().mockResolvedValue({ error: null });
      const mockDeleteEq1 = vi.fn().mockReturnValue({ eq: mockDeleteEq2 });
      mockDelete.mockReturnValue({ eq: mockDeleteEq1 });

      // 2) remaining check: .from("sign_ins").select("id").eq("user_id").eq("sign_in_date").limit(1)
      const mockRemainingLimit = vi.fn().mockResolvedValue({ data: [] });
      const mockRemainingEq2 = vi.fn().mockReturnValue({ limit: mockRemainingLimit });
      const mockRemainingEq1 = vi.fn().mockReturnValue({ eq: mockRemainingEq2 });
      const mockRemainingSelect = vi.fn().mockReturnValue({ eq: mockRemainingEq1 });

      // 3) profile update: .from("profiles").update({ last_sign_in_date: null }).eq("id")
      const mockProfileUpdateEq = vi.fn().mockResolvedValue({ error: null });
      const mockProfileUpdate = vi.fn().mockReturnValue({ eq: mockProfileUpdateEq });

      let signInsCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "sign_ins") {
          signInsCallCount++;
          if (signInsCallCount === 1) return { delete: mockDelete };
          return { select: mockRemainingSelect };
        }
        if (table === "profiles") return { update: mockProfileUpdate };
        return {};
      });

      const result = await deleteSignInEntry("entry-1");

      expect(result).toEqual({ success: true, error: null });
      expect(revalidatePath).toHaveBeenCalledWith("/sign-in");
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
      expect(mockProfileUpdate).toHaveBeenCalledWith({ last_sign_in_date: null });
    });

    it("deletes entry without clearing last_sign_in_date when entries remain", async () => {
      mockGetUserAuth.mockResolvedValue({
        data: { user: { id: "user-1" } },
      });

      const mockDeleteEq2 = vi.fn().mockResolvedValue({ error: null });
      const mockDeleteEq1 = vi.fn().mockReturnValue({ eq: mockDeleteEq2 });
      mockDelete.mockReturnValue({ eq: mockDeleteEq1 });

      // Remaining entries exist
      const mockRemainingLimit = vi.fn().mockResolvedValue({ data: [{ id: "other-entry" }] });
      const mockRemainingEq2 = vi.fn().mockReturnValue({ limit: mockRemainingLimit });
      const mockRemainingEq1 = vi.fn().mockReturnValue({ eq: mockRemainingEq2 });
      const mockRemainingSelect = vi.fn().mockReturnValue({ eq: mockRemainingEq1 });

      const mockProfileUpdate = vi.fn();

      let signInsCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "sign_ins") {
          signInsCallCount++;
          if (signInsCallCount === 1) return { delete: mockDelete };
          return { select: mockRemainingSelect };
        }
        if (table === "profiles") return { update: mockProfileUpdate };
        return {};
      });

      const result = await deleteSignInEntry("entry-1");

      expect(result).toEqual({ success: true, error: null });
      expect(mockProfileUpdate).not.toHaveBeenCalled();
    });
  });

  describe("getTeamSignInsToday", () => {
    it("returns error for non-managers", async () => {
      mockGetCurrentUser.mockResolvedValue({
        supabase: { from: mockFrom },
        user: { id: "user-1" },
        profile: { is_line_manager: false },
      });

      const result = await getTeamSignInsToday();
      expect(result).toEqual({
        members: [],
        error: "Unauthorized",
      });
    });

    it("returns empty for managers with no team members", async () => {
      const mockMemberOrder = vi.fn().mockResolvedValue({ data: [] });
      const mockMemberStatus = vi.fn().mockReturnValue({ order: mockMemberOrder });
      const mockMemberLineManager = vi.fn().mockReturnValue({ eq: mockMemberStatus });
      const mockMemberSelect = vi.fn().mockReturnValue({ eq: mockMemberLineManager });

      mockFrom.mockReturnValue({ select: mockMemberSelect });

      mockGetCurrentUser.mockResolvedValue({
        supabase: { from: mockFrom },
        user: { id: "manager-1" },
        profile: { is_line_manager: true },
      });

      const result = await getTeamSignInsToday();
      expect(result).toEqual({ members: [], error: null });
    });
  });

  describe("getTeamSignInHistory", () => {
    it("returns error for non-managers", async () => {
      mockGetCurrentUser.mockResolvedValue({
        supabase: { from: mockFrom },
        user: { id: "user-1" },
        profile: { is_line_manager: false },
      });

      const result = await getTeamSignInHistory({});
      expect(result).toEqual({
        data: [],
        members: [],
        error: "Unauthorized",
        truncated: false,
      });
    });
  });

  describe("checkAndCreateSignInNudge", () => {
    it("returns false when not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue({
        supabase: { from: mockFrom },
        user: null,
        profile: null,
      });

      const result = await checkAndCreateSignInNudge();
      expect(result).toBe(false);
    });

    it("returns false for non-staff users", async () => {
      mockGetCurrentUser.mockResolvedValue({
        supabase: { from: mockFrom },
        user: { id: "user-1" },
        profile: { user_type: "pathways_coordinator", last_sign_in_date: null },
      });

      const result = await checkAndCreateSignInNudge();
      expect(result).toBe(false);
    });

    it("returns false when staff has signed in today", async () => {
      const today = getUKToday();
      mockGetCurrentUser.mockResolvedValue({
        supabase: { from: mockFrom },
        user: { id: "user-1" },
        profile: { user_type: "staff", last_sign_in_date: today },
      });

      const result = await checkAndCreateSignInNudge();
      expect(result).toBe(false);
    });

    it("returns true and creates notification when staff has not signed in", async () => {
      // No existing notification
      mockLimit.mockResolvedValue({ data: [] });
      const mockNotifEq3 = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockNotifEq2 = vi.fn().mockReturnValue({ eq: mockNotifEq3 });
      const mockNotifEq1 = vi.fn().mockReturnValue({ eq: mockNotifEq2 });
      mockSelect.mockReturnValue({ eq: mockNotifEq1 });
      mockFrom.mockReturnValue({ select: mockSelect });

      mockGetCurrentUser.mockResolvedValue({
        supabase: { from: mockFrom },
        user: { id: "user-1" },
        profile: { user_type: "staff", last_sign_in_date: null },
      });

      const result = await checkAndCreateSignInNudge();
      expect(result).toBe(true);
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          type: "sign_in_reminder",
          link: "/sign-in",
        })
      );
    });

    it("returns true even when createNotification throws", async () => {
      mockLimit.mockResolvedValue({ data: [] });
      const mockNotifEq3 = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockNotifEq2 = vi.fn().mockReturnValue({ eq: mockNotifEq3 });
      const mockNotifEq1 = vi.fn().mockReturnValue({ eq: mockNotifEq2 });
      mockSelect.mockReturnValue({ eq: mockNotifEq1 });
      mockFrom.mockReturnValue({ select: mockSelect });

      mockGetCurrentUser.mockResolvedValue({
        supabase: { from: mockFrom },
        user: { id: "user-1" },
        profile: { user_type: "staff", last_sign_in_date: null },
      });

      mockCreateNotification.mockRejectedValue(new Error("Service unavailable"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await checkAndCreateSignInNudge();
      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to create sign-in nudge notification:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it("does not create duplicate notification", async () => {
      // Existing unread notification found
      mockLimit.mockResolvedValue({ data: [{ id: "notif-1" }] });
      const mockNotifEq3 = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockNotifEq2 = vi.fn().mockReturnValue({ eq: mockNotifEq3 });
      const mockNotifEq1 = vi.fn().mockReturnValue({ eq: mockNotifEq2 });
      mockSelect.mockReturnValue({ eq: mockNotifEq1 });
      mockFrom.mockReturnValue({ select: mockSelect });

      mockGetCurrentUser.mockResolvedValue({
        supabase: { from: mockFrom },
        user: { id: "user-1" },
        profile: { user_type: "staff", last_sign_in_date: null },
      });

      const result = await checkAndCreateSignInNudge();
      expect(result).toBe(true);
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });
  });
});
