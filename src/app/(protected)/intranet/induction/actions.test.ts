import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock strategy: Mock getCurrentUser() from @/lib/auth.
 * completeInduction uses two Supabase chains:
 *   1. .from("induction_progress").select("id", { count: "exact", head: true }).eq("user_id", userId)
 *   2. .from("profiles").update({...}).eq("id", userId)
 *
 * redirect() from next/navigation throws a NEXT_REDIRECT error on success.
 */

const mockEq = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
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

// Mock redirect to throw like Next.js does
const REDIRECT_ERROR = new Error("NEXT_REDIRECT");
(REDIRECT_ERROR as Record<string, unknown>).digest = "NEXT_REDIRECT";
vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw REDIRECT_ERROR;
  }),
}));

import {
  completeInduction,
  markInductionItemComplete,
} from "@/app/(protected)/intranet/induction/actions";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

describe("Induction Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getCurrentUser).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "user-1", email: "test@mcrpathways.org" } as never,
      profile: { id: "user-1" } as never,
    });
  });

  // ===========================================
  // completeInduction
  // ===========================================

  describe("completeInduction", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null,
        profile: null,
      });

      const result = await completeInduction();

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when fewer than 9 induction items are completed", async () => {
      // Chain: .from("induction_progress").select("id", { count, head }).eq("user_id", userId)
      mockEq.mockResolvedValue({ count: 5 });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await completeInduction();

      expect(result).toEqual({
        success: false,
        error: "Not all induction items have been completed",
      });
      expect(mockFrom).toHaveBeenCalledWith("induction_progress");
      expect(mockSelect).toHaveBeenCalledWith("id", { count: "exact", head: true });
    });

    it("returns error when count is 0 (no items completed)", async () => {
      mockEq.mockResolvedValue({ count: 0 });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await completeInduction();

      expect(result).toEqual({
        success: false,
        error: "Not all induction items have been completed",
      });
    });

    it("returns error when count is null", async () => {
      mockEq.mockResolvedValue({ count: null });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await completeInduction();

      expect(result).toEqual({
        success: false,
        error: "Not all induction items have been completed",
      });
    });

    it("updates profile and redirects when all 9 items are completed", async () => {
      // First call: induction_progress count
      const countEq = vi.fn().mockResolvedValue({ count: 9 });
      const countSelect = vi.fn().mockReturnValue({ eq: countEq });

      // Second call: profiles update
      const updateEq = vi.fn().mockResolvedValue({ error: null });
      const updateChain = vi.fn().mockReturnValue({ eq: updateEq });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: countSelect };
        return { update: updateChain };
      });

      await expect(completeInduction()).rejects.toThrow("NEXT_REDIRECT");

      expect(mockFrom).toHaveBeenCalledWith("profiles");
      expect(updateChain).toHaveBeenCalledWith(
        expect.objectContaining({
          induction_completed_at: expect.any(String),
          status: "active",
        })
      );
      expect(redirect).toHaveBeenCalledWith("/intranet");
    });

    it("returns error when profile update fails", async () => {
      // First call: count passes
      const countEq = vi.fn().mockResolvedValue({ count: 9 });
      const countSelect = vi.fn().mockReturnValue({ eq: countEq });

      // Second call: profiles update fails
      const updateEq = vi.fn().mockResolvedValue({
        error: { message: "Profile update failed" },
      });
      const updateChain = vi.fn().mockReturnValue({ eq: updateEq });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: countSelect };
        return { update: updateChain };
      });

      const result = await completeInduction();

      expect(result).toEqual({
        success: false,
        error: "Profile update failed",
      });
    });
  });

  // ===========================================
  // markInductionItemComplete
  // ===========================================

  describe("markInductionItemComplete", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null,
        profile: null,
      });

      const result = await markInductionItemComplete("welcome");

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("inserts progress and redirects on success", async () => {
      mockInsert.mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ insert: mockInsert });

      await expect(markInductionItemComplete("welcome")).rejects.toThrow(
        "NEXT_REDIRECT"
      );

      expect(mockFrom).toHaveBeenCalledWith("induction_progress");
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: "user-1",
        item_id: "welcome",
      });
      expect(redirect).toHaveBeenCalledWith("/intranet/induction");
    });

    it("handles duplicate item gracefully (unique constraint 23505)", async () => {
      mockInsert.mockResolvedValue({
        error: { code: "23505", message: "duplicate key value" },
      });
      mockFrom.mockReturnValue({ insert: mockInsert });

      await expect(markInductionItemComplete("welcome")).rejects.toThrow(
        "NEXT_REDIRECT"
      );

      expect(redirect).toHaveBeenCalledWith("/intranet/induction");
    });

    it("returns error on non-duplicate DB failure", async () => {
      mockInsert.mockResolvedValue({
        error: { code: "42P01", message: "relation does not exist" },
      });
      mockFrom.mockReturnValue({ insert: mockInsert });

      const result = await markInductionItemComplete("welcome");

      expect(result).toEqual({
        success: false,
        error: "relation does not exist",
      });
    });
  });
});
