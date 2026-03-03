import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Test strategy for key dates actions:
 *
 * All actions require HR admin (requireHRAdmin). Straightforward CRUD
 * with whitelist sanitisation on updates.
 */

// ── Hoisted mocks ──

const mockFrom = vi.hoisted(() => vi.fn());
const mockSupabase = vi.hoisted(() => ({
  from: mockFrom,
}));

vi.mock("@/lib/auth", () => ({
  requireHRAdmin: vi.fn().mockResolvedValue({
    supabase: mockSupabase,
    user: { id: "admin-123", email: "admin@mcrpathways.org" },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ── Import modules under test ──

import {
  createKeyDate,
  updateKeyDate,
  completeKeyDate,
  deleteKeyDate,
} from "@/app/(protected)/hr/key-dates/actions";
import { requireHRAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── Chainable mock helper ──

function chainable() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.eq = vi.fn().mockImplementation(self);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.update = vi.fn().mockImplementation(self);
  chain.insert = vi.fn().mockResolvedValue({ error: null });
  chain.delete = vi.fn().mockImplementation(self);
  return chain;
}

// ── Tests ──

describe("HR Key Dates Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireHRAdmin).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "admin-123", email: "admin@mcrpathways.org" } as never,
    });
  });

  // =============================================
  // createKeyDate
  // =============================================

  describe("createKeyDate", () => {
    it("creates a key date successfully", async () => {
      const c = chainable();
      mockFrom.mockReturnValue(c);

      const result = await createKeyDate({
        profile_id: "emp-456",
        date_type: "probation_end",
        due_date: "2026-06-30",
        title: "Probation Review",
      });

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith("key_dates");
      expect(revalidatePath).toHaveBeenCalledWith("/hr/users/emp-456");
      expect(revalidatePath).toHaveBeenCalledWith("/hr/key-dates");
    });

    it("returns error when required fields missing", async () => {
      const result = await createKeyDate({
        profile_id: "",
        date_type: "probation_end",
        due_date: "2026-06-30",
        title: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });

    it("returns error when title is missing", async () => {
      const result = await createKeyDate({
        profile_id: "emp-456",
        date_type: "probation_end",
        due_date: "2026-06-30",
        title: "",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });

    it("uses default alert_days_before when not provided", async () => {
      const c = chainable();
      mockFrom.mockReturnValue(c);

      await createKeyDate({
        profile_id: "emp-456",
        date_type: "appraisal",
        due_date: "2026-09-15",
        title: "Annual Appraisal",
      });

      // insert should have been called with alert_days_before: [30, 7]
      expect(c.insert).toHaveBeenCalledWith(
        expect.objectContaining({ alert_days_before: [30, 7] }),
      );
    });

    it("returns error on DB failure", async () => {
      const c = chainable();
      c.insert.mockResolvedValue({ error: { message: "DB error" } });
      mockFrom.mockReturnValue(c);

      const result = await createKeyDate({
        profile_id: "emp-456",
        date_type: "probation_end",
        due_date: "2026-06-30",
        title: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("DB error");
    });

    it("throws when user is not HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValue(new Error("Not authorised"));

      await expect(
        createKeyDate({
          profile_id: "emp-456",
          date_type: "probation_end",
          due_date: "2026-06-30",
          title: "Test",
        }),
      ).rejects.toThrow("Not authorised");
    });
  });

  // =============================================
  // updateKeyDate
  // =============================================

  describe("updateKeyDate", () => {
    function setupUpdateChain(opts?: {
      profileId?: string;
      updateError?: boolean;
    }) {
      const callLog: string[] = [];
      mockFrom.mockImplementation(() => {
        callLog.push("call");
        const c = chainable();
        if (callLog.length === 1) {
          // Fetch profile_id for revalidation
          c.single.mockResolvedValue({
            data: { profile_id: opts?.profileId ?? "emp-456" },
            error: null,
          });
        } else {
          // Update
          c.single.mockResolvedValue(
            opts?.updateError
              ? { data: null, error: { message: "Update failed" } }
              : { data: { id: "kd-1" }, error: null },
          );
        }
        return c;
      });
    }

    it("updates a key date successfully", async () => {
      setupUpdateChain();

      const result = await updateKeyDate("kd-1", {
        title: "Updated Title",
        due_date: "2026-12-31",
      });

      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/users/emp-456");
      expect(revalidatePath).toHaveBeenCalledWith("/hr/key-dates");
    });

    it("returns error when no valid fields provided", async () => {
      const result = await updateKeyDate("kd-1", {} as Parameters<typeof updateKeyDate>[1]);
      expect(result.success).toBe(false);
      expect(result.error).toContain("No valid fields");
    });

    it("returns error on DB failure", async () => {
      setupUpdateChain({ updateError: true });

      const result = await updateKeyDate("kd-1", { title: "Updated" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Update failed");
    });
  });

  // =============================================
  // completeKeyDate
  // =============================================

  describe("completeKeyDate", () => {
    function setupCompleteChain(opts?: {
      profileId?: string;
      updateError?: boolean;
    }) {
      const callLog: string[] = [];
      mockFrom.mockImplementation(() => {
        callLog.push("call");
        const c = chainable();
        if (callLog.length === 1) {
          c.single.mockResolvedValue({
            data: { profile_id: opts?.profileId ?? "emp-456" },
            error: null,
          });
        } else {
          c.single.mockResolvedValue(
            opts?.updateError
              ? { data: null, error: { message: "Complete failed" } }
              : { data: { id: "kd-1" }, error: null },
          );
        }
        return c;
      });
    }

    it("marks a key date as completed", async () => {
      setupCompleteChain();

      const result = await completeKeyDate("kd-1");
      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/key-dates");
    });

    it("returns error on DB failure", async () => {
      setupCompleteChain({ updateError: true });

      const result = await completeKeyDate("kd-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Complete failed");
    });

    it("throws when user is not HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValue(new Error("Not authorised"));
      await expect(completeKeyDate("kd-1")).rejects.toThrow("Not authorised");
    });
  });

  // =============================================
  // deleteKeyDate
  // =============================================

  describe("deleteKeyDate", () => {
    function setupDeleteChain(opts?: {
      keyDateData?: Record<string, unknown> | null;
      deleteError?: boolean;
    }) {
      const callLog: string[] = [];
      mockFrom.mockImplementation(() => {
        callLog.push("call");
        const c = chainable();
        if (callLog.length === 1) {
          // Fetch key date
          c.single.mockResolvedValue({
            data: opts?.keyDateData !== undefined ? opts.keyDateData : { profile_id: "emp-456" },
            error: null,
          });
        } else {
          // Delete
          c.eq.mockResolvedValue(
            opts?.deleteError
              ? { error: { message: "Delete failed" } }
              : { error: null },
          );
        }
        return c;
      });
    }

    it("deletes a key date successfully", async () => {
      setupDeleteChain();

      const result = await deleteKeyDate("kd-1");
      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/users/emp-456");
      expect(revalidatePath).toHaveBeenCalledWith("/hr/key-dates");
    });

    it("returns error when key date not found", async () => {
      setupDeleteChain({ keyDateData: null });

      const result = await deleteKeyDate("kd-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("returns error on DB delete failure", async () => {
      setupDeleteChain({ deleteError: true });

      const result = await deleteKeyDate("kd-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Delete failed");
    });

    it("throws when user is not HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValue(new Error("Not authorised"));
      await expect(deleteKeyDate("kd-1")).rejects.toThrow("Not authorised");
    });
  });
});
