import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Test strategy for flexible working actions:
 *
 * Mock `@/lib/auth` (requireHRAdmin / getCurrentUser) — same pattern as
 * absence/actions.test.ts. Per-test chainable mocks avoid shared mockEq issues.
 *
 * Actions and their key Supabase chains:
 *
 *   fetchFlexibleWorkingRequests: getCurrentUser → .from().select().order()
 *   fetchFlexibleWorkingRequest:  getCurrentUser → .from().select().eq().single()
 *                                 → .from().select().eq().order().limit().single()
 *   checkFWREligibility:          getCurrentUser → parallel .from().select().eq().neq().gte()
 *                                 + .from().select().eq().in()
 *   createFlexibleWorkingRequest: getCurrentUser → .from().select().eq().single() (profile)
 *                                 → .from().insert().select().single() (request)
 *                                 → .from().select().eq().eq() (HR admins)
 *                                 → .from().insert() (notifications)
 *   withdrawFlexibleWorkingRequest: getCurrentUser → .from().select().eq().single()
 *                                   → .from().update().eq().in().select().single()
 *   markRequestUnderReview:       getCurrentUser → verifyFWRAuthority
 *                                 → .from().update().eq().eq().select().single()
 *   recordConsultation:           getCurrentUser → verifyFWRAuthority
 *                                 → .from().update().eq().select().single()
 *   approveFlexibleWorkingRequest: getCurrentUser → verifyFWRAuthority
 *                                  → .from().update().eq().in().select().single()
 *                                  → .from().update().eq().select().single() (profile)
 *                                  → .from().insert() (employment_history + notification)
 *   rejectFlexibleWorkingRequest: getCurrentUser → verifyFWRAuthority
 *                                 → .from().update().eq().in().select().single()
 *   recordTrialOutcome:           getCurrentUser → verifyFWRAuthority
 *                                 → .from().update().eq().eq().select().single()
 *   submitFWRAppeal:              getCurrentUser → .from().select().eq().single()
 *                                 → .from().insert().select().single() (appeal)
 *                                 → .from().update().eq().eq().select().single()
 *   decideFWRAppeal:              requireHRAdmin → .from().select().eq().single()
 *                                 → .from().select().eq().order().limit().single() (appeal)
 *                                 → .from().update().eq().select().single()
 *                                 → .from().update().eq().eq().select().single()
 */

// ── Hoisted mocks ──

const mockFrom = vi.hoisted(() => vi.fn());
const mockSupabase = vi.hoisted(() => ({
  from: mockFrom,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    supabase: mockSupabase,
    user: { id: "user-123", email: "user@mcrpathways.org" },
    profile: { id: "user-123", user_type: "staff" },
  }),
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
  fetchFlexibleWorkingRequests,
  fetchFlexibleWorkingRequest,
  checkFWREligibility,
  createFlexibleWorkingRequest,
  withdrawFlexibleWorkingRequest,
  markRequestUnderReview,
  recordConsultation,
  approveFlexibleWorkingRequest,
  rejectFlexibleWorkingRequest,
  recordTrialOutcome,
  submitFWRAppeal,
  decideFWRAppeal,
} from "@/app/(protected)/hr/flexible-working/actions";
import { getCurrentUser, requireHRAdmin } from "@/lib/auth";

// ── Chainable mock helper ──

function chainable() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.eq = vi.fn().mockImplementation(self);
  chain.neq = vi.fn().mockImplementation(self);
  chain.in = vi.fn().mockImplementation(self);
  chain.is = vi.fn().mockImplementation(self);
  chain.lte = vi.fn().mockImplementation(self);
  chain.gte = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockImplementation(self);
  chain.order = vi.fn().mockImplementation(self);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.update = vi.fn().mockImplementation(self);
  chain.insert = vi.fn().mockImplementation(self);
  chain.delete = vi.fn().mockImplementation(self);
  return chain;
}

// ── Tests ──

describe("HR Flexible Working Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getCurrentUser).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "user-123", email: "user@mcrpathways.org" } as never,
      profile: { id: "user-123", user_type: "staff" } as never,
    });

    vi.mocked(requireHRAdmin).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "admin-123", email: "admin@mcrpathways.org" } as never,
    });
  });

  // =============================================
  // fetchFlexibleWorkingRequests
  // =============================================

  describe("fetchFlexibleWorkingRequests", () => {
    it("returns empty when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await fetchFlexibleWorkingRequests();
      expect(result).toEqual({ data: [], error: "Not authenticated" });
    });

    it("returns requests on success", async () => {
      const mockRequests = [
        { id: "req-1", status: "submitted", profile_id: "user-123" },
        { id: "req-2", status: "approved", profile_id: "user-456" },
      ];

      const c = chainable();
      c.order.mockResolvedValue({ data: mockRequests, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchFlexibleWorkingRequests();
      expect(result.data).toEqual(mockRequests);
      expect(result.error).toBeNull();
    });

    it("returns error message on DB failure", async () => {
      const c = chainable();
      c.order.mockResolvedValue({ data: null, error: { message: "DB error" } });
      mockFrom.mockReturnValue(c);

      const result = await fetchFlexibleWorkingRequests();
      expect(result.data).toEqual([]);
      expect(result.error).toContain("Failed to fetch flexible working requests");
    });
  });

  // =============================================
  // fetchFlexibleWorkingRequest
  // =============================================

  describe("fetchFlexibleWorkingRequest", () => {
    it("returns null when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await fetchFlexibleWorkingRequest("req-1");
      expect(result).toEqual({ data: null, appeal: null, error: "Not authenticated" });
    });

    it("returns request without appeal for non-appeal statuses", async () => {
      const mockRequest = { id: "req-1", status: "submitted", profile_id: "user-123" };

      const c = chainable();
      c.single.mockResolvedValue({ data: mockRequest, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchFlexibleWorkingRequest("req-1");
      expect(result.data).toEqual(mockRequest);
      expect(result.appeal).toBeNull();
      expect(result.error).toBeNull();
    });

    it("fetches appeal when status is appealed", async () => {
      const mockRequest = { id: "req-1", status: "appealed", profile_id: "user-123" };
      const mockAppeal = { id: "appeal-1", request_id: "req-1", appeal_reason: "Disagree" };

      // First call: fetch request; second call: fetch appeal
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.single.mockResolvedValue({ data: mockRequest, error: null });
        } else {
          c.single.mockResolvedValue({ data: mockAppeal, error: null });
        }
        return c;
      });

      const result = await fetchFlexibleWorkingRequest("req-1");
      expect(result.data).toEqual(mockRequest);
      expect(result.appeal).toEqual(mockAppeal);
    });

    it("returns error when request not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: { message: "not found" } });
      mockFrom.mockReturnValue(c);

      const result = await fetchFlexibleWorkingRequest("nonexistent");
      expect(result.data).toBeNull();
      expect(result.error).toBe("Request not found");
    });
  });

  // =============================================
  // checkFWREligibility
  // =============================================

  describe("checkFWREligibility", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await checkFWREligibility();
      expect(result.eligible).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });

    it("returns eligible when no requests in 12 months and no live request", async () => {
      // Both parallel queries return empty
      const c = chainable();
      c.gte.mockResolvedValue({ data: [], error: null });
      c.in.mockResolvedValue({ data: [], error: null });
      mockFrom.mockReturnValue(c);

      const result = await checkFWREligibility();
      expect(result.eligible).toBe(true);
      expect(result.requestsInLast12Months).toBe(0);
      expect(result.hasLiveRequest).toBe(false);
    });

    it("returns ineligible when 2 requests in 12 months", async () => {
      const c = chainable();
      c.gte.mockResolvedValue({ data: [{ id: "r1" }, { id: "r2" }], error: null });
      c.in.mockResolvedValue({ data: [], error: null });
      mockFrom.mockReturnValue(c);

      const result = await checkFWREligibility();
      expect(result.eligible).toBe(false);
      expect(result.requestsInLast12Months).toBe(2);
    });

    it("returns ineligible when live request exists", async () => {
      const c = chainable();
      c.gte.mockResolvedValue({ data: [], error: null });
      c.in.mockResolvedValue({ data: [{ id: "live-1" }], error: null });
      mockFrom.mockReturnValue(c);

      const result = await checkFWREligibility();
      expect(result.eligible).toBe(false);
      expect(result.hasLiveRequest).toBe(true);
    });
  });

  // =============================================
  // createFlexibleWorkingRequest
  // =============================================

  describe("createFlexibleWorkingRequest", () => {
    const validData = {
      request_type: "remote_hybrid",
      current_working_pattern: "Office 5 days a week",
      requested_working_pattern: "3 days office, 2 days home",
      proposed_start_date: "2026-04-01",
      reason: "Childcare",
    };

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await createFlexibleWorkingRequest(validData);
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("rejects missing required fields", async () => {
      const result = await createFlexibleWorkingRequest({
        request_type: "",
        current_working_pattern: "",
        requested_working_pattern: "",
        proposed_start_date: "",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });

    it("rejects invalid request type", async () => {
      const result = await createFlexibleWorkingRequest({
        ...validData,
        request_type: "invalid_type",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid request type");
    });

    it("rejects text that exceeds max length", async () => {
      const result = await createFlexibleWorkingRequest({
        ...validData,
        current_working_pattern: "x".repeat(5001),
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("exceeds the maximum");
    });

    it("creates request successfully and sends notifications", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch employee profile
          c.single.mockResolvedValue({
            data: {
              id: "user-123",
              line_manager_id: "mgr-456",
              work_pattern: "standard",
              full_name: "Jane Doe",
            },
            error: null,
          });
        } else if (callCount === 2) {
          // Insert request
          c.single.mockResolvedValue({
            data: { id: "new-req-1" },
            error: null,
          });
        }
        // Calls 3+ are HR admin fetch + notifications — non-critical, defaults suffice

        return c;
      });

      const result = await createFlexibleWorkingRequest(validData);
      expect(result.success).toBe(true);
      expect(result.requestId).toBe("new-req-1");
    });

    it("returns friendly error on unique constraint violation (live request exists)", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch profile
          c.single.mockResolvedValue({
            data: {
              id: "user-123",
              line_manager_id: null,
              work_pattern: "standard",
              full_name: "Jane Doe",
            },
            error: null,
          });
        } else if (callCount === 2) {
          // Insert fails with unique constraint
          c.single.mockResolvedValue({
            data: null,
            error: { code: "23505", message: "unique_violation" },
          });
        }

        return c;
      });

      const result = await createFlexibleWorkingRequest(validData);
      expect(result.success).toBe(false);
      expect(result.error).toContain("already have an active flexible working request");
    });

    it("returns friendly error on 2-request statutory limit", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: {
              id: "user-123",
              line_manager_id: null,
              work_pattern: "standard",
              full_name: "Jane Doe",
            },
            error: null,
          });
        } else if (callCount === 2) {
          c.single.mockResolvedValue({
            data: null,
            error: { code: "P0001", message: "2 flexible working requests in the last 12 months" },
          });
        }

        return c;
      });

      const result = await createFlexibleWorkingRequest(validData);
      expect(result.success).toBe(false);
      expect(result.error).toContain("2 flexible working requests");
    });

    it("returns error when profile not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await createFlexibleWorkingRequest(validData);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Profile not found");
    });
  });

  // =============================================
  // withdrawFlexibleWorkingRequest
  // =============================================

  describe("withdrawFlexibleWorkingRequest", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await withdrawFlexibleWorkingRequest("req-1");
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when request not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await withdrawFlexibleWorkingRequest("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Request not found");
    });

    it("returns error when withdrawing someone else's request", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "req-1", profile_id: "other-user", status: "submitted" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await withdrawFlexibleWorkingRequest("req-1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("You can only withdraw your own requests");
    });

    it("returns error when request status disallows withdrawal", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "req-1", profile_id: "user-123", status: "approved" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await withdrawFlexibleWorkingRequest("req-1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("This request can no longer be withdrawn");
    });

    it("withdraws successfully", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch request
          c.single.mockResolvedValue({
            data: { id: "req-1", profile_id: "user-123", status: "submitted" },
            error: null,
          });
        } else if (callCount === 2) {
          // Update status
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        }

        return c;
      });

      const result = await withdrawFlexibleWorkingRequest("req-1");
      expect(result.success).toBe(true);
    });
  });

  // =============================================
  // markRequestUnderReview
  // =============================================

  describe("markRequestUnderReview", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await markRequestUnderReview("req-1");
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when request not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await markRequestUnderReview("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Request not found");
    });

    it("returns error when request not in submitted status", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "req-1", profile_id: "emp-1", manager_id: "user-123", status: "approved" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await markRequestUnderReview("req-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("no longer in 'submitted' status");
    });

    it("returns error when user is not authorised", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch request
          c.single.mockResolvedValue({
            data: { id: "req-1", profile_id: "emp-1", manager_id: "mgr-other", status: "submitted" },
            error: null,
          });
        } else if (callCount === 2) {
          // verifyFWRAuthority: check current user's is_hr_admin
          c.single.mockResolvedValue({
            data: { id: "user-123", is_hr_admin: false },
            error: null,
          });
        } else if (callCount === 3) {
          // verifyFWRAuthority: check employee's line_manager_id
          c.single.mockResolvedValue({
            data: { line_manager_id: "mgr-other" },
            error: null,
          });
        }

        return c;
      });

      const result = await markRequestUnderReview("req-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not authorised");
    });

    it("marks request as under review when user is line manager", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch request
          c.single.mockResolvedValue({
            data: { id: "req-1", profile_id: "emp-1", manager_id: "user-123", status: "submitted" },
            error: null,
          });
        } else if (callCount === 2) {
          // verifyFWRAuthority: check current user is not HR admin
          c.single.mockResolvedValue({
            data: { id: "user-123", is_hr_admin: false },
            error: null,
          });
        } else if (callCount === 3) {
          // verifyFWRAuthority: check employee's line_manager_id matches
          c.single.mockResolvedValue({
            data: { line_manager_id: "user-123" },
            error: null,
          });
        } else if (callCount === 4) {
          // Update status
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        }

        return c;
      });

      const result = await markRequestUnderReview("req-1");
      expect(result.success).toBe(true);
    });

    it("marks request as under review when user is HR admin", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch request
          c.single.mockResolvedValue({
            data: { id: "req-1", profile_id: "emp-1", manager_id: "mgr-other", status: "submitted" },
            error: null,
          });
        } else if (callCount === 2) {
          // verifyFWRAuthority: current user is HR admin
          c.single.mockResolvedValue({
            data: { id: "user-123", is_hr_admin: true },
            error: null,
          });
        } else if (callCount === 3) {
          // Update status
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        }

        return c;
      });

      const result = await markRequestUnderReview("req-1");
      expect(result.success).toBe(true);
    });
  });

  // =============================================
  // recordConsultation
  // =============================================

  describe("recordConsultation", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await recordConsultation("req-1", {});
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when request not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await recordConsultation("req-1", {});
      expect(result.success).toBe(false);
      expect(result.error).toBe("Request not found");
    });

    it("rejects consultation on non-active requests", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "req-1", profile_id: "emp-1", manager_id: "user-123", status: "approved" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await recordConsultation("req-1", {
        consultation_date: "2026-03-15",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("only be recorded on active requests");
    });

    it("rejects invalid consultation format", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { id: "req-1", profile_id: "emp-1", manager_id: "user-123", status: "under_review" },
            error: null,
          });
        } else if (callCount === 2) {
          // verifyFWRAuthority — HR admin
          c.single.mockResolvedValue({
            data: { id: "user-123", is_hr_admin: true },
            error: null,
          });
        }

        return c;
      });

      const result = await recordConsultation("req-1", {
        consultation_format: "carrier_pigeon",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid consultation format");
    });

    it("rejects when no valid consultation fields provided", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { id: "req-1", profile_id: "emp-1", manager_id: "user-123", status: "under_review" },
            error: null,
          });
        } else if (callCount === 2) {
          c.single.mockResolvedValue({
            data: { id: "user-123", is_hr_admin: true },
            error: null,
          });
        }

        return c;
      });

      const result = await recordConsultation("req-1", {
        invalid_field: "something",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("No valid consultation fields provided");
    });

    it("records consultation successfully", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { id: "req-1", profile_id: "emp-1", manager_id: "user-123", status: "under_review" },
            error: null,
          });
        } else if (callCount === 2) {
          // verifyFWRAuthority — HR admin
          c.single.mockResolvedValue({
            data: { id: "user-123", is_hr_admin: true },
            error: null,
          });
        } else if (callCount === 3) {
          // Update consultation
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        }

        return c;
      });

      const result = await recordConsultation("req-1", {
        consultation_date: "2026-03-15",
        consultation_format: "video",
        consultation_summary: "Discussed flexible arrangements",
      });
      expect(result.success).toBe(true);
    });
  });

  // =============================================
  // approveFlexibleWorkingRequest
  // =============================================

  describe("approveFlexibleWorkingRequest", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await approveFlexibleWorkingRequest("req-1", {});
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when request not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await approveFlexibleWorkingRequest("req-1", {});
      expect(result.success).toBe(false);
      expect(result.error).toBe("Request not found");
    });

    it("returns error when request status disallows approval", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "req-1", profile_id: "emp-1", manager_id: "user-123", status: "rejected" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await approveFlexibleWorkingRequest("req-1", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("can no longer be approved");
    });

    it("approves request with trial period", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch request
          c.single.mockResolvedValue({
            data: {
              id: "req-1",
              profile_id: "emp-1",
              manager_id: "user-123",
              status: "under_review",
              request_type: "remote_hybrid",
              requested_working_pattern: "3 days office, 2 days home",
              previous_work_pattern: "standard",
              proposed_start_date: "2026-04-01",
            },
            error: null,
          });
        } else if (callCount === 2) {
          // verifyFWRAuthority — HR admin
          c.single.mockResolvedValue({
            data: { id: "user-123", is_hr_admin: true },
            error: null,
          });
        } else if (callCount === 3) {
          // Update request status (trial)
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        } else if (callCount === 4) {
          // Notification insert
          c.insert.mockResolvedValue({ data: null, error: null });
        }

        return c;
      });

      const result = await approveFlexibleWorkingRequest("req-1", {
        trial_period: true,
        trial_end_date: "2026-06-01",
        decision_notes: "Trial for 2 months",
      });
      expect(result.success).toBe(true);
    });

    it("approves request permanently and updates profile work_pattern", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch request (compressed_hours maps to 'compressed' work_pattern)
          c.single.mockResolvedValue({
            data: {
              id: "req-1",
              profile_id: "emp-1",
              manager_id: "user-123",
              status: "submitted",
              request_type: "compressed_hours",
              requested_working_pattern: "4-day week",
              previous_work_pattern: "standard",
              proposed_start_date: "2026-04-01",
            },
            error: null,
          });
        } else if (callCount === 2) {
          // verifyFWRAuthority — HR admin
          c.single.mockResolvedValue({
            data: { id: "user-123", is_hr_admin: true },
            error: null,
          });
        } else if (callCount === 3) {
          // Update request status (approved)
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        } else if (callCount === 4) {
          // Update profile work_pattern
          c.single.mockResolvedValue({ data: { id: "emp-1" }, error: null });
        } else if (callCount === 5) {
          // Insert employment_history
          c.insert.mockResolvedValue({ data: null, error: null });
        } else if (callCount === 6) {
          // Insert notification
          c.insert.mockResolvedValue({ data: null, error: null });
        }

        return c;
      });

      const result = await approveFlexibleWorkingRequest("req-1", {
        decision_notes: "Approved",
      });
      expect(result.success).toBe(true);
    });

    it("rolls back request status when profile update fails", async () => {
      let callCount = 0;
      const rollbackChain = chainable();

      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch request
          c.single.mockResolvedValue({
            data: {
              id: "req-1",
              profile_id: "emp-1",
              manager_id: "user-123",
              status: "under_review",
              request_type: "compressed_hours",
              requested_working_pattern: "4-day week",
              previous_work_pattern: "standard",
              proposed_start_date: "2026-04-01",
            },
            error: null,
          });
        } else if (callCount === 2) {
          // verifyFWRAuthority
          c.single.mockResolvedValue({
            data: { id: "user-123", is_hr_admin: true },
            error: null,
          });
        } else if (callCount === 3) {
          // Update request status — succeeds
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        } else if (callCount === 4) {
          // Update profile — FAILS
          c.single.mockResolvedValue({
            data: null,
            error: { message: "profile update failed" },
          });
        } else if (callCount === 5) {
          // Rollback request status
          return rollbackChain;
        }

        return c;
      });

      const result = await approveFlexibleWorkingRequest("req-1", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to update employee's work pattern");
    });

    it("rejects decision_notes that exceed max length", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: {
              id: "req-1",
              profile_id: "emp-1",
              manager_id: "user-123",
              status: "submitted",
              request_type: "remote_hybrid",
            },
            error: null,
          });
        } else if (callCount === 2) {
          c.single.mockResolvedValue({
            data: { id: "user-123", is_hr_admin: true },
            error: null,
          });
        }

        return c;
      });

      const result = await approveFlexibleWorkingRequest("req-1", {
        decision_notes: "x".repeat(5001),
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("exceeds the maximum");
    });
  });

  // =============================================
  // rejectFlexibleWorkingRequest
  // =============================================

  describe("rejectFlexibleWorkingRequest", () => {
    const validRejectData = {
      rejection_grounds: ["additional_costs"],
      rejection_explanation: "Budget constraints prevent this arrangement.",
      decision_notes: "Reviewed with finance team",
    };

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await rejectFlexibleWorkingRequest("req-1", validRejectData);
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("requires at least one rejection ground", async () => {
      const result = await rejectFlexibleWorkingRequest("req-1", {
        rejection_grounds: [],
        rejection_explanation: "Some reason",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("statutory ground");
    });

    it("requires rejection explanation", async () => {
      const result = await rejectFlexibleWorkingRequest("req-1", {
        rejection_grounds: ["additional_costs"],
        rejection_explanation: "",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("explanation");
    });

    it("rejects invalid rejection ground", async () => {
      const result = await rejectFlexibleWorkingRequest("req-1", {
        rejection_grounds: ["because_i_said_so"],
        rejection_explanation: "Just because",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid rejection ground");
    });

    it("requires consultation before rejection (Acas Code of Practice)", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch request — no consultation_date
          c.single.mockResolvedValue({
            data: {
              id: "req-1",
              profile_id: "emp-1",
              manager_id: "user-123",
              status: "under_review",
              consultation_date: null,
            },
            error: null,
          });
        }

        return c;
      });

      const result = await rejectFlexibleWorkingRequest("req-1", validRejectData);
      expect(result.success).toBe(false);
      expect(result.error).toContain("consultation meeting");
      expect(result.error).toContain("Acas");
    });

    it("rejects request successfully after consultation", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch request — with consultation_date
          c.single.mockResolvedValue({
            data: {
              id: "req-1",
              profile_id: "emp-1",
              manager_id: "user-123",
              status: "under_review",
              consultation_date: "2026-03-10",
            },
            error: null,
          });
        } else if (callCount === 2) {
          // verifyFWRAuthority
          c.single.mockResolvedValue({
            data: { id: "user-123", is_hr_admin: true },
            error: null,
          });
        } else if (callCount === 3) {
          // Update request (reject)
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        } else if (callCount === 4) {
          // Insert notification
          c.insert.mockResolvedValue({ data: null, error: null });
        }

        return c;
      });

      const result = await rejectFlexibleWorkingRequest("req-1", validRejectData);
      expect(result.success).toBe(true);
    });
  });

  // =============================================
  // recordTrialOutcome
  // =============================================

  describe("recordTrialOutcome", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await recordTrialOutcome("req-1", { outcome: "confirmed" });
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("rejects invalid trial outcome", async () => {
      const result = await recordTrialOutcome("req-1", { outcome: "maybe" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid trial outcome");
    });

    it("rejects if request is not in approved_trial status", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: {
          id: "req-1",
          profile_id: "emp-1",
          manager_id: "user-123",
          status: "approved",
          request_type: "compressed_hours",
        },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await recordTrialOutcome("req-1", { outcome: "confirmed" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not in a trial period");
    });

    it("confirms trial and updates profile work_pattern", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch request
          c.single.mockResolvedValue({
            data: {
              id: "req-1",
              profile_id: "emp-1",
              manager_id: "user-123",
              status: "approved_trial",
              request_type: "reduced_hours",
              requested_working_pattern: "3 days/week",
              previous_work_pattern: "standard",
              proposed_start_date: "2026-01-01",
            },
            error: null,
          });
        } else if (callCount === 2) {
          // verifyFWRAuthority
          c.single.mockResolvedValue({
            data: { id: "user-123", is_hr_admin: true },
            error: null,
          });
        } else if (callCount === 3) {
          // Update request (confirmed)
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        } else if (callCount === 4) {
          // Update profile work_pattern
          c.single.mockResolvedValue({ data: { id: "emp-1" }, error: null });
        } else if (callCount === 5) {
          // Insert employment_history
          c.insert.mockResolvedValue({ data: null, error: null });
        } else if (callCount === 6) {
          // Notification
          c.insert.mockResolvedValue({ data: null, error: null });
        }

        return c;
      });

      const result = await recordTrialOutcome("req-1", { outcome: "confirmed" });
      expect(result.success).toBe(true);
    });

    it("requires extended_end_date when extending", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: {
              id: "req-1",
              profile_id: "emp-1",
              manager_id: "user-123",
              status: "approved_trial",
              request_type: "remote_hybrid",
            },
            error: null,
          });
        } else if (callCount === 2) {
          c.single.mockResolvedValue({
            data: { id: "user-123", is_hr_admin: true },
            error: null,
          });
        }

        return c;
      });

      const result = await recordTrialOutcome("req-1", { outcome: "extended" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Extended end date is required");
    });

    it("extends trial with new end date", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: {
              id: "req-1",
              profile_id: "emp-1",
              manager_id: "user-123",
              status: "approved_trial",
              request_type: "remote_hybrid",
            },
            error: null,
          });
        } else if (callCount === 2) {
          c.single.mockResolvedValue({
            data: { id: "user-123", is_hr_admin: true },
            error: null,
          });
        } else if (callCount === 3) {
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        } else if (callCount === 4) {
          // Notification
          c.insert.mockResolvedValue({ data: null, error: null });
        }

        return c;
      });

      const result = await recordTrialOutcome("req-1", {
        outcome: "extended",
        extended_end_date: "2026-09-01",
      });
      expect(result.success).toBe(true);
    });

    it("rolls back request when profile update fails on confirmation", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: {
              id: "req-1",
              profile_id: "emp-1",
              manager_id: "user-123",
              status: "approved_trial",
              request_type: "compressed_hours",
              requested_working_pattern: "4-day week",
              previous_work_pattern: "standard",
            },
            error: null,
          });
        } else if (callCount === 2) {
          c.single.mockResolvedValue({
            data: { id: "user-123", is_hr_admin: true },
            error: null,
          });
        } else if (callCount === 3) {
          // Update request (confirmed) — succeeds
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        } else if (callCount === 4) {
          // Update profile — FAILS
          c.single.mockResolvedValue({
            data: null,
            error: { message: "profile update failed" },
          });
        }

        // Remaining calls are rollback — don't need specific mocking
        return c;
      });

      const result = await recordTrialOutcome("req-1", { outcome: "confirmed" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to update employee's work pattern");
    });
  });

  // =============================================
  // submitFWRAppeal
  // =============================================

  describe("submitFWRAppeal", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await submitFWRAppeal("req-1", "I disagree");
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("requires appeal reason", async () => {
      const result = await submitFWRAppeal("req-1", "");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Appeal reason is required");
    });

    it("returns error when appealing someone else's request", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "req-1", profile_id: "other-user", status: "rejected" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await submitFWRAppeal("req-1", "I disagree");
      expect(result.success).toBe(false);
      expect(result.error).toBe("You can only appeal your own requests");
    });

    it("only allows appeals on rejected requests", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "req-1", profile_id: "user-123", status: "approved" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await submitFWRAppeal("req-1", "I disagree");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Only rejected requests can be appealed");
    });

    it("submits appeal successfully", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch request
          c.single.mockResolvedValue({
            data: { id: "req-1", profile_id: "user-123", status: "rejected" },
            error: null,
          });
        } else if (callCount === 2) {
          // Insert appeal
          c.single.mockResolvedValue({ data: { id: "appeal-1" }, error: null });
        } else if (callCount === 3) {
          // Update request status to appealed
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        } else if (callCount === 4) {
          // Fetch employee name for notification
          c.single.mockResolvedValue({
            data: { full_name: "Jane Doe" },
            error: null,
          });
        } else if (callCount === 5) {
          // Fetch HR admins
          c.eq.mockResolvedValue({
            data: [{ id: "admin-789" }],
            error: null,
          });
        } else if (callCount === 6) {
          // Insert notifications
          c.insert.mockResolvedValue({ data: null, error: null });
        }

        return c;
      });

      const result = await submitFWRAppeal("req-1", "I disagree with the decision");
      expect(result.success).toBe(true);
    });

    it("rejects appeal reason that exceeds max length", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "req-1", profile_id: "user-123", status: "rejected" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await submitFWRAppeal("req-1", "x".repeat(5001));
      expect(result.success).toBe(false);
      expect(result.error).toContain("exceeds the maximum");
    });
  });

  // =============================================
  // decideFWRAppeal
  // =============================================

  describe("decideFWRAppeal", () => {
    it("requires HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValueOnce(new Error("Not authorised"));

      await expect(decideFWRAppeal("req-1", { outcome: "upheld" })).rejects.toThrow();
    });

    it("rejects invalid appeal outcome", async () => {
      const result = await decideFWRAppeal("req-1", {
        outcome: "maybe" as "upheld" | "overturned",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid appeal outcome");
    });

    it("returns error when request not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await decideFWRAppeal("req-1", { outcome: "upheld" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Request not found");
    });

    it("returns error when request not in appealed status", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "req-1", profile_id: "emp-1", status: "rejected" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await decideFWRAppeal("req-1", { outcome: "upheld" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not in 'appealed' status");
    });

    it("upholds appeal successfully (rejection stands)", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch request
          c.single.mockResolvedValue({
            data: {
              id: "req-1",
              profile_id: "emp-1",
              status: "appealed",
              request_type: "remote_hybrid",
            },
            error: null,
          });
        } else if (callCount === 2) {
          // Fetch appeal record
          c.single.mockResolvedValue({
            data: { id: "appeal-1" },
            error: null,
          });
        } else if (callCount === 3) {
          // Update appeal record
          c.single.mockResolvedValue({ data: { id: "appeal-1" }, error: null });
        } else if (callCount === 4) {
          // Update request status to appeal_upheld
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        } else if (callCount === 5) {
          // Insert notification
          c.insert.mockResolvedValue({ data: null, error: null });
        }

        return c;
      });

      const result = await decideFWRAppeal("req-1", {
        outcome: "upheld",
        outcome_notes: "Original decision was correct",
      });
      expect(result.success).toBe(true);
    });

    it("overturns appeal and updates profile work_pattern", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch request (compressed_hours maps to 'compressed')
          c.single.mockResolvedValue({
            data: {
              id: "req-1",
              profile_id: "emp-1",
              status: "appealed",
              request_type: "compressed_hours",
              requested_working_pattern: "4-day week",
              previous_work_pattern: "standard",
              proposed_start_date: "2026-04-01",
            },
            error: null,
          });
        } else if (callCount === 2) {
          // Fetch appeal
          c.single.mockResolvedValue({ data: { id: "appeal-1" }, error: null });
        } else if (callCount === 3) {
          // Update appeal
          c.single.mockResolvedValue({ data: { id: "appeal-1" }, error: null });
        } else if (callCount === 4) {
          // Update request status to appeal_overturned
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        } else if (callCount === 5) {
          // Update profile work_pattern
          c.single.mockResolvedValue({ data: { id: "emp-1" }, error: null });
        } else if (callCount === 6) {
          // Insert employment_history
          c.insert.mockResolvedValue({ data: null, error: null });
        } else if (callCount === 7) {
          // Insert notification
          c.insert.mockResolvedValue({ data: null, error: null });
        }

        return c;
      });

      const result = await decideFWRAppeal("req-1", {
        outcome: "overturned",
        outcome_notes: "Appeal successful",
        meeting_date: "2026-03-15",
        meeting_notes: "Reviewed with panel",
      });
      expect(result.success).toBe(true);
    });

    it("rolls back appeal and request on profile update failure during overturn", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: {
              id: "req-1",
              profile_id: "emp-1",
              status: "appealed",
              request_type: "compressed_hours",
              requested_working_pattern: "4-day week",
              previous_work_pattern: "standard",
              proposed_start_date: "2026-04-01",
            },
            error: null,
          });
        } else if (callCount === 2) {
          c.single.mockResolvedValue({ data: { id: "appeal-1" }, error: null });
        } else if (callCount === 3) {
          // Update appeal — succeeds
          c.single.mockResolvedValue({ data: { id: "appeal-1" }, error: null });
        } else if (callCount === 4) {
          // Update request — succeeds
          c.single.mockResolvedValue({ data: { id: "req-1" }, error: null });
        } else if (callCount === 5) {
          // Update profile — FAILS
          c.single.mockResolvedValue({
            data: null,
            error: { message: "profile update failed" },
          });
        }

        // Calls 6-7 are rollback chains — use default chainable
        return c;
      });

      const result = await decideFWRAppeal("req-1", {
        outcome: "overturned",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to update employee's work pattern");
    });

    it("returns error when appeal record not found", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: {
              id: "req-1",
              profile_id: "emp-1",
              status: "appealed",
              request_type: "remote_hybrid",
            },
            error: null,
          });
        } else if (callCount === 2) {
          // No appeal record found
          c.single.mockResolvedValue({ data: null, error: null });
        }

        return c;
      });

      const result = await decideFWRAppeal("req-1", { outcome: "upheld" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Appeal record not found");
    });
  });
});
