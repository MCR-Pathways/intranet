import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock strategy: Instead of mocking the low-level Supabase client (which
 * involves complex fluent chain re-wiring), we mock `@/lib/auth` directly.
 * This lets us control what `requireHRAdmin()` returns without dealing
 * with the `.from().select().eq().single()` chain it uses internally.
 *
 * The actions only use the `supabase` object returned by requireHRAdmin()
 * for a simple `.from("profiles").update({...}).eq("id", userId)` call.
 */

// Create mock chain for the update operations used by the actions
const mockEq = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

// Mock Supabase client returned by requireHRAdmin
const mockSupabase = vi.hoisted(() => ({
  from: mockFrom,
  rpc: mockRpc,
}));

// Mock requireHRAdmin — returns { supabase, user } on success
vi.mock("@/lib/auth", () => ({
  requireHRAdmin: vi.fn().mockResolvedValue({
    supabase: mockSupabase,
    user: { id: "admin-123", email: "admin@mcrpathways.org" },
  }),
}));

// Mock next/cache (revalidatePath used after mutations)
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Import modules under test AFTER mocks are registered
import {
  updateUserProfile,
  completeUserInduction,
  resetUserInduction,
} from "@/app/(protected)/hr/users/actions";
import { requireHRAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

describe("HR User Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-wire the update chain: .from("profiles").update({...}).eq("id", x)
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });
    mockRpc.mockResolvedValue({ error: null });

    // Default: requireHRAdmin succeeds
    vi.mocked(requireHRAdmin).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "admin-123", email: "admin@mcrpathways.org" } as never,
    });
  });

  describe("updateUserProfile", () => {
    it("passes only whitelisted fields to the database", async () => {
      const result = await updateUserProfile("user-456", {
        full_name: "Jane Doe",
        job_title: "Manager",
        user_type: "staff",
        status: "active",
        is_hr_admin: false,
        is_line_manager: true,
      });

      expect(result).toEqual({ success: true, error: null });
      expect(mockFrom).toHaveBeenCalledWith("profiles");
      expect(mockUpdate).toHaveBeenCalledWith({
        full_name: "Jane Doe",
        job_title: "Manager",
        user_type: "staff",
        status: "active",
        is_hr_admin: false,
        is_line_manager: true,
      });
      expect(mockEq).toHaveBeenCalledWith("id", "user-456");
      expect(revalidatePath).toHaveBeenCalledWith("/hr/users");
    });

    it("strips unknown fields from the update payload", async () => {
      await updateUserProfile("user-456", {
        full_name: "Jane Doe",
        google_refresh_token: "SHOULD_BE_STRIPPED",
        email: "SHOULD_BE_STRIPPED",
        id: "SHOULD_BE_STRIPPED",
      } as Record<string, unknown> as Parameters<typeof updateUserProfile>[1]);

      // Only full_name passes the whitelist
      expect(mockUpdate).toHaveBeenCalledWith({
        full_name: "Jane Doe",
      });
    });

    it("returns error when no valid fields are provided", async () => {
      const result = await updateUserProfile(
        "user-456",
        {} as Parameters<typeof updateUserProfile>[1]
      );

      expect(result).toEqual({
        success: false,
        error: "No valid fields to update",
      });
      // Should not attempt DB update
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("returns error when DB update fails", async () => {
      mockEq.mockResolvedValue({
        error: { message: "Database constraint violation" },
      });

      const result = await updateUserProfile("user-456", {
        full_name: "Jane Doe",
      });

      expect(result).toEqual({
        success: false,
        error: "Database constraint violation",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("throws when user is not authenticated", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValue(
        new Error("Not authenticated")
      );

      await expect(
        updateUserProfile("user-456", { full_name: "Jane" })
      ).rejects.toThrow("Not authenticated");
    });

    it("throws when user is not an HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValue(
        new Error("Unauthorised: HR admin access required")
      );

      await expect(
        updateUserProfile("user-456", { full_name: "Jane" })
      ).rejects.toThrow("Unauthorised: HR admin access required");
    });
  });

  describe("completeUserInduction", () => {
    it("sets induction_completed_at and status to active", async () => {
      const result = await completeUserInduction("user-456");

      expect(result).toEqual({ success: true, error: null });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "active",
          induction_completed_at: expect.any(String),
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/hr/users");
    });

    it("returns error when DB update fails", async () => {
      mockEq.mockResolvedValue({
        error: { message: "Update failed" },
      });

      const result = await completeUserInduction("user-456");

      expect(result).toEqual({ success: false, error: "Update failed" });
    });
  });

  describe("resetUserInduction", () => {
    it("calls the reset_user_induction RPC with the correct user ID", async () => {
      const result = await resetUserInduction("user-456");

      expect(result).toEqual({ success: true, error: null });
      expect(mockRpc).toHaveBeenCalledWith("reset_user_induction", {
        target_user_id: "user-456",
      });
      expect(revalidatePath).toHaveBeenCalledWith("/hr/users");
    });

    it("returns error when RPC call fails", async () => {
      mockRpc.mockResolvedValue({
        error: { message: "Reset failed" },
      });

      const result = await resetUserInduction("user-456");

      expect(result).toEqual({ success: false, error: "Reset failed" });
    });
  });
});
