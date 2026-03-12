import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Test strategy for leave actions:
 *
 * Same pattern as absence/actions.test.ts — mock `@/lib/auth` (requireHRAdmin /
 * getCurrentUser) instead of the Supabase client. Use per-test mockFrom.mockImplementation
 * with call counters to handle different chain shapes per Supabase call.
 *
 * Key patterns tested:
 *   - requestLeave: getCurrentUser → only REQUESTABLE_LEAVE_TYPES allowed
 *   - withdrawLeave: getCurrentUser → ownership check via .eq("profile_id", user.id)
 *   - approveLeave/rejectLeave: getCurrentUser → verifyLeaveDecisionAuthority
 *   - cancelLeave: requireHRAdmin → approved-only guard
 *   - recordLeave: requireHRAdmin → all leave types allowed, auto-approved
 *   - upsertLeaveEntitlement: requireHRAdmin → upsert with onConflict
 */

// ── Helper: build a chainable mock that returns self ──

function chainable() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.eq = vi.fn().mockImplementation(self);
  chain.neq = vi.fn().mockImplementation(self);
  chain.in = vi.fn().mockImplementation(self);
  chain.lte = vi.fn().mockImplementation(self);
  chain.gte = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
  chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.update = vi.fn().mockImplementation(self);
  chain.insert = vi.fn().mockImplementation(self);
  chain.upsert = vi.fn().mockResolvedValue({ error: null });
  chain.delete = vi.fn().mockImplementation(self);
  return chain;
}

// ── Hoisted mocks ──

const mockFrom = vi.hoisted(() => vi.fn());
const mockSupabase = vi.hoisted(() => ({ from: mockFrom }));

vi.mock("@/lib/auth", () => ({
  requireHRAdmin: vi.fn().mockResolvedValue({
    supabase: mockSupabase,
    user: { id: "admin-123", email: "admin@mcrpathways.org" },
  }),
  getCurrentUser: vi.fn().mockResolvedValue({
    supabase: mockSupabase,
    user: { id: "user-123", email: "user@mcrpathways.org" },
    profile: { id: "user-123", user_type: "staff" },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ── Import modules under test ──

import {
  fetchPublicHolidays,
  requestLeave,
  withdrawLeave,
  approveLeave,
  rejectLeave,
  cancelLeave,
  recordLeave,
  upsertLeaveEntitlement,
} from "@/app/(protected)/hr/leave/actions";
import { requireHRAdmin, getCurrentUser } from "@/lib/auth";

// ── Tests ──

describe("HR Leave Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default auth — requireHRAdmin succeeds
    vi.mocked(requireHRAdmin).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "admin-123", email: "admin@mcrpathways.org" } as never,
    });

    // Default auth — getCurrentUser succeeds
    vi.mocked(getCurrentUser).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "user-123", email: "user@mcrpathways.org" } as never,
      profile: { id: "user-123", user_type: "staff" } as never,
    });
  });

  // =============================================
  // fetchPublicHolidays
  // =============================================

  describe("fetchPublicHolidays", () => {
    it("returns empty array when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await fetchPublicHolidays(null);
      expect(result).toEqual([]);
    });

    it("returns holiday dates for scotland region", async () => {
      const c = chainable();
      c.order.mockResolvedValue({
        data: [
          { holiday_date: "2026-01-01" },
          { holiday_date: "2026-01-02" },
          { holiday_date: "2026-12-25" },
        ],
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await fetchPublicHolidays("scotland", 2026);
      expect(result).toEqual(["2026-01-01", "2026-01-02", "2026-12-25"]);
    });

    it("returns empty array when no holidays found", async () => {
      const c = chainable();
      c.order.mockResolvedValue({ data: [], error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchPublicHolidays("england", 2026);
      expect(result).toEqual([]);
    });

    it("uses current year when year not specified", async () => {
      const c = chainable();
      c.order.mockResolvedValue({ data: [], error: null });
      mockFrom.mockReturnValue(c);

      await fetchPublicHolidays(null);
      expect(mockFrom).toHaveBeenCalledWith("public_holidays");
    });
  });

  // =============================================
  // requestLeave
  // =============================================

  describe("requestLeave", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await requestLeave({
        leave_type: "annual",
        start_date: "2026-03-02",
        end_date: "2026-03-03",
      });
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error for non-requestable leave type", async () => {
      const result = await requestLeave({
        leave_type: "sick_full_pay",
        start_date: "2026-03-02",
        end_date: "2026-03-03",
      });
      expect(result).toEqual({
        success: false,
        error: "Invalid leave type for self-service request",
      });
    });

    it("returns error for missing dates", async () => {
      const result = await requestLeave({
        leave_type: "annual",
        start_date: "",
        end_date: "2026-03-03",
      });
      expect(result).toEqual({
        success: false,
        error: "Start and end dates are required",
      });
    });

    it("returns error when end date is before start date", async () => {
      const result = await requestLeave({
        leave_type: "annual",
        start_date: "2026-03-05",
        end_date: "2026-03-03",
      });
      expect(result).toEqual({
        success: false,
        error: "End date cannot be before start date",
      });
    });

    it("returns error when no working days in range", async () => {
      // Weekend dates
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        const c = chainable();
        if (table === "profiles") {
          c.single.mockResolvedValue({ data: { region: "scotland", fte: 1.0 }, error: null });
        } else if (table === "public_holidays") {
          c.order.mockResolvedValue({ data: [], error: null });
        }
        return c;
      });

      const result = await requestLeave({
        leave_type: "annual",
        start_date: "2026-03-07", // Saturday
        end_date: "2026-03-08",   // Sunday
      });
      expect(result).toEqual({
        success: false,
        error: "No working days in the selected date range",
      });
    });

    it("creates leave request successfully", async () => {
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        const c = chainable();
        if (table === "profiles") {
          c.single.mockResolvedValue({ data: { region: "scotland", fte: 1.0 }, error: null });
        } else if (table === "public_holidays") {
          c.order.mockResolvedValue({ data: [], error: null });
        } else if (table === "leave_requests") {
          c.insert.mockResolvedValue({ error: null });
        }
        return c;
      });

      const result = await requestLeave({
        leave_type: "annual",
        start_date: "2026-03-02", // Monday
        end_date: "2026-03-03",   // Tuesday
      });
      expect(result).toEqual({ success: true, error: null });
    });

    it("returns error when DB insert fails", async () => {
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        const c = chainable();
        if (table === "profiles") {
          c.single.mockResolvedValue({ data: { region: "scotland", fte: 1.0 }, error: null });
        } else if (table === "public_holidays") {
          c.order.mockResolvedValue({ data: [], error: null });
        } else if (table === "leave_requests") {
          c.insert.mockResolvedValue({ error: { message: "Constraint violation" } });
        }
        return c;
      });

      const result = await requestLeave({
        leave_type: "annual",
        start_date: "2026-03-02",
        end_date: "2026-03-03",
      });
      expect(result).toEqual({ success: false, error: "Constraint violation" });
    });

    it("accepts all requestable leave types", async () => {
      const requestableTypes = ["annual", "compassionate", "unpaid", "toil", "study"];
      for (const type of requestableTypes) {
        vi.clearAllMocks();
        vi.mocked(getCurrentUser).mockResolvedValue({
          supabase: mockSupabase as never,
          user: { id: "user-123", email: "user@mcrpathways.org" } as never,
          profile: { id: "user-123", user_type: "staff" } as never,
        });

        mockFrom.mockImplementation((table: string) => {
          const c = chainable();
          if (table === "profiles") {
            c.single.mockResolvedValue({ data: { region: "scotland", fte: 1.0 }, error: null });
          } else if (table === "public_holidays") {
            c.order.mockResolvedValue({ data: [], error: null });
          } else {
            c.insert.mockResolvedValue({ error: null });
          }
          return c;
        });

        const result = await requestLeave({
          leave_type: type,
          start_date: "2026-03-02",
          end_date: "2026-03-03",
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects non-requestable leave types", async () => {
      const nonRequestable = ["sick_full_pay", "sick_half_pay", "sick_no_pay", "maternity", "paternity"];
      for (const type of nonRequestable) {
        const result = await requestLeave({
          leave_type: type,
          start_date: "2026-03-02",
          end_date: "2026-03-03",
        });
        expect(result.success).toBe(false);
      }
    });
  });

  // =============================================
  // withdrawLeave
  // =============================================

  describe("withdrawLeave", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await withdrawLeave("req-1");
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("withdraws pending request successfully", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
      mockFrom.mockReturnValue(c);

      const result = await withdrawLeave("req-1");
      expect(result).toEqual({ success: true, error: null });
    });

    it("returns error when request not found or not pending", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: { message: "PGRST116" } });
      mockFrom.mockReturnValue(c);

      const result = await withdrawLeave("req-nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not withdraw");
    });
  });

  // =============================================
  // approveLeave
  // =============================================

  describe("approveLeave", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await approveLeave("req-1");
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when request not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await approveLeave("req-nonexistent");
      expect(result).toEqual({ success: false, error: "Request not found or not pending" });
    });

    it("returns error when request is not pending", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "req-1", profile_id: "emp-1", status: "approved" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await approveLeave("req-1");
      expect(result).toEqual({ success: false, error: "Request not found or not pending" });
    });

    it("returns error when user is not authorised", async () => {
      const callCounts: Record<string, number> = {};
      mockFrom.mockImplementation((table: string) => {
        callCounts[table] = (callCounts[table] ?? 0) + 1;
        const c = chainable();
        if (table === "leave_requests") {
          c.single.mockResolvedValue({
            data: { id: "req-1", profile_id: "emp-1", status: "pending" },
            error: null,
          });
        } else if (table === "profiles" && callCounts[table] === 1) {
          // Check current user — not HR admin
          c.single.mockResolvedValue({ data: { is_hr_admin: false }, error: null });
        } else if (table === "profiles" && callCounts[table] === 2) {
          // Check requester — different line manager
          c.single.mockResolvedValue({ data: { line_manager_id: "other-manager" }, error: null });
        }
        return c;
      });

      const result = await approveLeave("req-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not authorised");
    });

    it("approves pending request as HR admin", async () => {
      const callCounts: Record<string, number> = {};
      mockFrom.mockImplementation((table: string) => {
        callCounts[table] = (callCounts[table] ?? 0) + 1;
        const c = chainable();
        if (table === "leave_requests" && callCounts[table] === 1) {
          // Fetch request
          c.single.mockResolvedValue({
            data: { id: "req-1", profile_id: "emp-1", status: "pending" },
            error: null,
          });
        } else if (table === "profiles") {
          // HR admin check
          c.single.mockResolvedValue({ data: { is_hr_admin: true }, error: null });
        } else {
          // Update
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        }
        return c;
      });

      const result = await approveLeave("req-1", "Approved");
      expect(result).toEqual({ success: true, error: null });
    });

    it("approves pending request as line manager", async () => {
      const callCounts: Record<string, number> = {};
      mockFrom.mockImplementation((table: string) => {
        callCounts[table] = (callCounts[table] ?? 0) + 1;
        const c = chainable();
        if (table === "leave_requests" && callCounts[table] === 1) {
          c.single.mockResolvedValue({
            data: { id: "req-1", profile_id: "emp-1", status: "pending" },
            error: null,
          });
        } else if (table === "profiles" && callCounts[table] === 1) {
          // Current user — not HR admin
          c.single.mockResolvedValue({ data: { is_hr_admin: false }, error: null });
        } else if (table === "profiles" && callCounts[table] === 2) {
          // Requester — line manager is current user
          c.single.mockResolvedValue({ data: { line_manager_id: "user-123" }, error: null });
        } else {
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        }
        return c;
      });

      const result = await approveLeave("req-1");
      expect(result).toEqual({ success: true, error: null });
    });
  });

  // =============================================
  // rejectLeave
  // =============================================

  describe("rejectLeave", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await rejectLeave("req-1", "Not enough notice");
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when reason is empty", async () => {
      const result = await rejectLeave("req-1", "");
      expect(result).toEqual({
        success: false,
        error: "A reason is required when rejecting leave",
      });
    });

    it("returns error when reason is whitespace only", async () => {
      const result = await rejectLeave("req-1", "   ");
      expect(result).toEqual({
        success: false,
        error: "A reason is required when rejecting leave",
      });
    });

    it("returns error when request not found or not pending", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await rejectLeave("req-nonexistent", "Not enough notice");
      expect(result).toEqual({ success: false, error: "Request not found or not pending" });
    });

    it("rejects request successfully with reason", async () => {
      const callCounts: Record<string, number> = {};
      mockFrom.mockImplementation((table: string) => {
        callCounts[table] = (callCounts[table] ?? 0) + 1;
        const c = chainable();
        if (table === "leave_requests" && callCounts[table] === 1) {
          c.single.mockResolvedValue({
            data: { id: "req-1", profile_id: "emp-1", status: "pending" },
            error: null,
          });
        } else if (table === "profiles") {
          c.single.mockResolvedValue({ data: { is_hr_admin: true }, error: null });
        } else {
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        }
        return c;
      });

      const result = await rejectLeave("req-1", "Team capacity too low");
      expect(result).toEqual({ success: true, error: null });
    });
  });

  // =============================================
  // cancelLeave
  // =============================================

  describe("cancelLeave", () => {
    it("requires HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValue(new Error("Not authorised"));
      await expect(cancelLeave("req-1")).rejects.toThrow("Not authorised");
    });

    it("returns error when request not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await cancelLeave("req-nonexistent");
      expect(result).toEqual({
        success: false,
        error: "Request not found or not in approved state",
      });
    });

    it("returns error when request is not approved", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "req-1", profile_id: "emp-1", status: "pending" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await cancelLeave("req-1");
      expect(result).toEqual({
        success: false,
        error: "Request not found or not in approved state",
      });
    });

    it("cancels approved request successfully", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { id: "req-1", profile_id: "emp-1", status: "approved" },
            error: null,
          });
        } else {
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        }
        return c;
      });

      const result = await cancelLeave("req-1");
      expect(result).toEqual({ success: true, error: null });
    });

    it("returns error when DB update fails", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { id: "req-1", profile_id: "emp-1", status: "approved" },
            error: null,
          });
        } else {
          c.single.mockResolvedValue({
            data: null,
            error: { message: "Concurrent update" },
          });
        }
        return c;
      });

      const result = await cancelLeave("req-1");
      expect(result).toEqual({ success: false, error: "Concurrent update" });
    });
  });

  // =============================================
  // recordLeave
  // =============================================

  describe("recordLeave", () => {
    it("requires HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValue(new Error("Not authorised"));
      await expect(
        recordLeave({
          profile_id: "emp-1",
          leave_type: "annual",
          start_date: "2026-03-02",
          end_date: "2026-03-03",
        })
      ).rejects.toThrow("Not authorised");
    });

    it("returns error for missing required fields", async () => {
      const result = await recordLeave({
        profile_id: "",
        leave_type: "annual",
        start_date: "2026-03-02",
        end_date: "2026-03-03",
      });
      expect(result).toEqual({
        success: false,
        error: "Employee, leave type, and dates are required",
      });
    });

    it("returns error for invalid leave type", async () => {
      const result = await recordLeave({
        profile_id: "emp-1",
        leave_type: "invalid_type",
        start_date: "2026-03-02",
        end_date: "2026-03-03",
      });
      expect(result).toEqual({
        success: false,
        error: "Invalid leave type. Please select a valid option.",
      });
    });

    it("accepts HR-only leave types", async () => {
      mockFrom.mockImplementation((table: string) => {
        const c = chainable();
        if (table === "profiles") {
          c.single.mockResolvedValue({ data: { region: "scotland" }, error: null });
        } else if (table === "public_holidays") {
          c.order.mockResolvedValue({ data: [], error: null });
        } else if (table === "leave_requests") {
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        }
        return c;
      });

      const result = await recordLeave({
        profile_id: "emp-1",
        leave_type: "sick",
        start_date: "2026-03-02",
        end_date: "2026-03-03",
      });
      expect(result.success).toBe(true);
    });

    it("returns error when end date is before start date", async () => {
      const result = await recordLeave({
        profile_id: "emp-1",
        leave_type: "annual",
        start_date: "2026-03-05",
        end_date: "2026-03-03",
      });
      expect(result).toEqual({
        success: false,
        error: "End date cannot be before start date",
      });
    });

    it("returns error when no working days in range", async () => {
      mockFrom.mockImplementation((table: string) => {
        const c = chainable();
        if (table === "profiles") {
          c.single.mockResolvedValue({ data: { region: "scotland" }, error: null });
        } else if (table === "public_holidays") {
          c.order.mockResolvedValue({ data: [], error: null });
        }
        return c;
      });

      const result = await recordLeave({
        profile_id: "emp-1",
        leave_type: "sick",
        start_date: "2026-03-07", // Saturday
        end_date: "2026-03-08",   // Sunday
      });
      expect(result).toEqual({
        success: false,
        error: "No working days in the selected date range",
      });
    });

    it("records leave successfully with auto-approved status", async () => {
      mockFrom.mockImplementation((table: string) => {
        const c = chainable();
        if (table === "profiles") {
          c.single.mockResolvedValue({ data: { region: "scotland" }, error: null });
        } else if (table === "public_holidays") {
          c.order.mockResolvedValue({ data: [], error: null });
        } else if (table === "leave_requests") {
          c.insert.mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "new-leave-1" }, error: null }),
            }),
          });
        }
        return c;
      });

      const result = await recordLeave({
        profile_id: "emp-1",
        leave_type: "sick",
        start_date: "2026-03-02",
        end_date: "2026-03-03",
      });
      expect(result).toEqual({ success: true, error: null });
    });

    it("allows HR-only leave types (sick, maternity, etc.)", async () => {
      const hrOnlyTypes = ["sick", "maternity", "paternity", "jury_service"];
      for (const type of hrOnlyTypes) {
        vi.clearAllMocks();
        vi.mocked(requireHRAdmin).mockResolvedValue({
          supabase: mockSupabase as never,
          user: { id: "admin-123", email: "admin@mcrpathways.org" } as never,
        });

        mockFrom.mockImplementation((table: string) => {
          const c = chainable();
          if (table === "profiles") {
            c.single.mockResolvedValue({ data: { region: "scotland" }, error: null });
          } else if (table === "public_holidays") {
            c.order.mockResolvedValue({ data: [], error: null });
          } else {
            c.insert.mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: "new-leave-1" }, error: null }),
              }),
            });
          }
          return c;
        });

        const result = await recordLeave({
          profile_id: "emp-1",
          leave_type: type,
          start_date: "2026-03-02",
          end_date: "2026-03-03",
        });
        expect(result.success).toBe(true);
      }
    });
  });

  // =============================================
  // upsertLeaveEntitlement
  // =============================================

  describe("upsertLeaveEntitlement", () => {
    it("requires HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValue(new Error("Not authorised"));
      await expect(
        upsertLeaveEntitlement({
          profile_id: "emp-1",
          leave_type: "annual",
          base_entitlement_days: 25,
          fte_at_calculation: 1.0,
        })
      ).rejects.toThrow("Not authorised");
    });

    it("returns error for negative base entitlement", async () => {
      const result = await upsertLeaveEntitlement({
        profile_id: "emp-1",
        leave_type: "annual",
        base_entitlement_days: -5,
        fte_at_calculation: 1.0,
      });
      expect(result).toEqual({
        success: false,
        error: "Base entitlement cannot be negative",
      });
    });

    it("upserts entitlement successfully", async () => {
      const c = chainable();
      mockFrom.mockReturnValue(c);

      const result = await upsertLeaveEntitlement({
        profile_id: "emp-1",
        leave_type: "annual",
        base_entitlement_days: 25,
        fte_at_calculation: 1.0,
      });
      expect(result).toEqual({ success: true, error: null });
      expect(mockFrom).toHaveBeenCalledWith("leave_entitlements");
    });

    it("returns error when upsert fails", async () => {
      const c = chainable();
      c.upsert.mockResolvedValue({ error: { message: "Unique constraint" } });
      mockFrom.mockReturnValue(c);

      const result = await upsertLeaveEntitlement({
        profile_id: "emp-1",
        leave_type: "annual",
        base_entitlement_days: 25,
        fte_at_calculation: 1.0,
      });
      expect(result).toEqual({ success: false, error: "Unique constraint" });
    });

    it("uses default leave year when not specified", async () => {
      const c = chainable();
      mockFrom.mockReturnValue(c);

      const result = await upsertLeaveEntitlement({
        profile_id: "emp-1",
        leave_type: "annual",
        base_entitlement_days: 25,
        fte_at_calculation: 0.8,
      });
      expect(result).toEqual({ success: true, error: null });
    });

    it("accepts zero base entitlement", async () => {
      const c = chainable();
      mockFrom.mockReturnValue(c);

      const result = await upsertLeaveEntitlement({
        profile_id: "emp-1",
        leave_type: "annual",
        base_entitlement_days: 0,
        fte_at_calculation: 1.0,
      });
      expect(result).toEqual({ success: true, error: null });
    });
  });
});
