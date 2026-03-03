import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Test strategy for leaving actions:
 *
 * Mock `@/lib/auth` (getCurrentUser / requireHRAdmin) — same pattern as
 * absence/actions.test.ts. Actions use multi-table Supabase chains:
 *
 *   verifyLeavingAuthority: .from("profiles").select().in() → returns profiles array
 *   createLeavingForm:      getCurrentUser → verifyLeavingAuthority → calculateFinalLeaveBalance
 *                           → .from("staff_leaving_forms").insert().select().single()
 *   updateLeavingForm:      getCurrentUser → .from("staff_leaving_forms").select().eq().single()
 *                           → verifyLeavingAuthority → .from("staff_leaving_forms").update().eq().select().single()
 *   submitLeavingForm:      getCurrentUser → fetch form → verifyLeavingAuthority → update status
 *                           → fetch employee name → fetch HR admins → insert notifications
 *   startProcessingForm:    requireHRAdmin → fetch form → update status
 *   completeLeavingForm:    requireHRAdmin → fetch form → update form → insert employment_history
 *                           → update profile → notify initiator
 *   cancelLeavingForm:      requireHRAdmin → fetch form → update status
 *   fetchLeavingFormSummary: getCurrentUser → verifyLeavingAuthority → parallel fetches
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
  verifyLeavingAuthority,
  createLeavingForm,
  updateLeavingForm,
  submitLeavingForm,
  startProcessingForm,
  completeLeavingForm,
  cancelLeavingForm,
  fetchLeavingFormSummary,
} from "@/app/(protected)/hr/leaving/actions";
import { getCurrentUser, requireHRAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
  chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
  chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.update = vi.fn().mockImplementation(self);
  chain.insert = vi.fn().mockImplementation(self);
  chain.delete = vi.fn().mockImplementation(self);
  return chain;
}

// ── Tests ──

describe("HR Leaving Actions", () => {
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
  // verifyLeavingAuthority
  // =============================================

  describe("verifyLeavingAuthority", () => {
    it("authorises HR admin", async () => {
      const c = chainable();
      c.in.mockResolvedValue({
        data: [
          { id: "admin-123", is_hr_admin: true, line_manager_id: null },
          { id: "emp-456", is_hr_admin: false, line_manager_id: "mgr-789" },
        ],
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await verifyLeavingAuthority(mockSupabase as never, "admin-123", "emp-456");
      expect(result).toEqual({ authorised: true, isHRAdmin: true });
    });

    it("authorises line manager", async () => {
      const c = chainable();
      c.in.mockResolvedValue({
        data: [
          { id: "mgr-123", is_hr_admin: false, line_manager_id: null },
          { id: "emp-456", is_hr_admin: false, line_manager_id: "mgr-123" },
        ],
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await verifyLeavingAuthority(mockSupabase as never, "mgr-123", "emp-456");
      expect(result).toEqual({ authorised: true, isHRAdmin: false });
    });

    it("denies unauthorised users", async () => {
      const c = chainable();
      c.in.mockResolvedValue({
        data: [
          { id: "random-user", is_hr_admin: false, line_manager_id: null },
          { id: "emp-456", is_hr_admin: false, line_manager_id: "mgr-789" },
        ],
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await verifyLeavingAuthority(mockSupabase as never, "random-user", "emp-456");
      expect(result.authorised).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("denies when profiles not found", async () => {
      const c = chainable();
      c.in.mockResolvedValue({ data: [], error: null });
      mockFrom.mockReturnValue(c);

      const result = await verifyLeavingAuthority(mockSupabase as never, "user-123", "emp-456");
      expect(result.authorised).toBe(false);
    });
  });

  // =============================================
  // createLeavingForm
  // =============================================

  describe("createLeavingForm", () => {
    function setupCreateChain(opts?: {
      authorised?: boolean;
      insertResult?: { data: unknown; error: unknown };
    }) {
      const calls: string[] = [];
      mockFrom.mockImplementation((table: string) => {
        const c = chainable();
        if (table === "profiles") {
          calls.push("profiles");
          // verifyLeavingAuthority profiles fetch
          c.in.mockResolvedValue({
            data: opts?.authorised !== false
              ? [
                  { id: "user-123", is_hr_admin: true, line_manager_id: null },
                  { id: "emp-456", is_hr_admin: false, line_manager_id: null },
                ]
              : [
                  { id: "user-123", is_hr_admin: false, line_manager_id: null },
                  { id: "emp-456", is_hr_admin: false, line_manager_id: "other-mgr" },
                ],
            error: null,
          });
          // calculateFinalLeaveBalance profile start_date
          c.single.mockResolvedValue({
            data: { start_date: "2024-01-15" },
            error: null,
          });
          return c;
        }
        if (table === "leave_entitlements") {
          calls.push("leave_entitlements");
          c.single.mockResolvedValue({ data: [], error: null });
          // Return empty entitlements for simplicity
          return c;
        }
        if (table === "leave_requests") {
          calls.push("leave_requests");
          return c;
        }
        if (table === "staff_leaving_forms") {
          calls.push("staff_leaving_forms");
          c.single.mockResolvedValue(
            opts?.insertResult ?? { data: { id: "form-new-123" }, error: null },
          );
          return c;
        }
        return c;
      });
    }

    it("creates a leaving form successfully", async () => {
      setupCreateChain();

      const result = await createLeavingForm({
        profile_id: "emp-456",
        leaving_date: "2026-06-30",
        reason_for_leaving: "resignation",
      });

      expect(result.success).toBe(true);
      expect(result.formId).toBe("form-new-123");
      expect(revalidatePath).toHaveBeenCalledWith("/hr/leaving");
    });

    it("returns error for missing required fields", async () => {
      const result = await createLeavingForm({
        profile_id: "",
        leaving_date: "2026-06-30",
        reason_for_leaving: "resignation",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });

    it("returns error for invalid leaving reason", async () => {
      const result = await createLeavingForm({
        profile_id: "emp-456",
        leaving_date: "2026-06-30",
        reason_for_leaving: "fired_for_fun",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid leaving reason");
    });

    it("returns error when user is not authorised", async () => {
      setupCreateChain({ authorised: false });

      const result = await createLeavingForm({
        profile_id: "emp-456",
        leaving_date: "2026-06-30",
        reason_for_leaving: "resignation",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not authorised");
    });

    it("returns error for duplicate active form (unique constraint)", async () => {
      setupCreateChain({
        insertResult: { data: null, error: { code: "23505", message: "unique violation" } },
      });

      const result = await createLeavingForm({
        profile_id: "emp-456",
        leaving_date: "2026-06-30",
        reason_for_leaving: "resignation",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("already has an active leaving form");
    });

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await createLeavingForm({
        profile_id: "emp-456",
        leaving_date: "2026-06-30",
        reason_for_leaving: "resignation",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Not authenticated");
    });
  });

  // =============================================
  // updateLeavingForm
  // =============================================

  describe("updateLeavingForm", () => {
    function setupUpdateChain(opts?: {
      formData?: Record<string, unknown> | null;
      authorised?: boolean;
      updateResult?: { data: unknown; error: unknown };
    }) {
      const formCallCount = { value: 0 };
      mockFrom.mockImplementation((table: string) => {
        const c = chainable();
        if (table === "staff_leaving_forms") {
          formCallCount.value++;
          if (formCallCount.value === 1) {
            // Fetch form
            c.single.mockResolvedValue({
              data: opts?.formData !== undefined
                ? opts.formData
                : { id: "form-1", profile_id: "emp-456", status: "draft" },
              error: null,
            });
          } else {
            // Update
            c.single.mockResolvedValue(
              opts?.updateResult !== undefined
                ? opts.updateResult
                : { data: { id: "form-1" }, error: null },
            );
          }
          return c;
        }
        if (table === "profiles") {
          c.in.mockResolvedValue({
            data: opts?.authorised !== false
              ? [{ id: "user-123", is_hr_admin: true, line_manager_id: null }]
              : [{ id: "user-123", is_hr_admin: false, line_manager_id: null }],
            error: null,
          });
          return c;
        }
        return c;
      });
    }

    it("updates a draft form successfully", async () => {
      setupUpdateChain();

      const result = await updateLeavingForm("form-1", {
        reason_details: "Personal reasons",
        exit_interview_completed: true,
      });

      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/leaving");
    });

    it("returns error for form not found", async () => {
      setupUpdateChain({ formData: null });

      const result = await updateLeavingForm("form-1", { reason_details: "test" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("returns error for completed form", async () => {
      setupUpdateChain({ formData: { id: "form-1", profile_id: "emp-456", status: "completed" } });

      const result = await updateLeavingForm("form-1", { reason_details: "test" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("can no longer be edited");
    });

    it("returns error for invalid leaving reason", async () => {
      setupUpdateChain();

      const result = await updateLeavingForm("form-1", { reason_for_leaving: "invalid_reason" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid leaving reason");
    });

    it("sanitises fields — strips disallowed fields", async () => {
      setupUpdateChain();

      const result = await updateLeavingForm("form-1", {
        reason_details: "Personal",
        profile_id: "SHOULD_BE_STRIPPED",
        initiated_by: "SHOULD_BE_STRIPPED",
      } as Record<string, unknown>);

      // No valid fields from allowed list would match profile_id or initiated_by
      // But reason_details IS allowed
      expect(result.success).toBe(true);
    });

    it("returns error when no valid fields provided", async () => {
      setupUpdateChain();

      const result = await updateLeavingForm("form-1", {
        profile_id: "STRIPPED",
        initiated_by: "STRIPPED",
      } as Record<string, unknown>);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No valid fields");
    });
  });

  // =============================================
  // submitLeavingForm
  // =============================================

  describe("submitLeavingForm", () => {
    function setupSubmitChain(opts?: {
      formStatus?: string;
      formData?: Record<string, unknown> | null;
      authorised?: boolean;
      updateResult?: { data: unknown; error: unknown };
      notifError?: boolean;
    }) {
      const formCallCount = { value: 0 };
      mockFrom.mockImplementation((table: string) => {
        const c = chainable();
        if (table === "staff_leaving_forms") {
          formCallCount.value++;
          if (formCallCount.value === 1) {
            // Fetch form
            c.single.mockResolvedValue({
              data: opts?.formData !== undefined
                ? opts.formData
                : {
                    id: "form-1",
                    profile_id: "emp-456",
                    initiated_by: "user-123",
                    status: opts?.formStatus ?? "draft",
                    leaving_date: "2026-06-30",
                    reason_for_leaving: "resignation",
                  },
              error: null,
            });
          } else {
            // Update status (or rollback)
            c.single.mockResolvedValue(
              opts?.updateResult !== undefined
                ? opts.updateResult
                : { data: { id: "form-1" }, error: null },
            );
          }
          return c;
        }
        if (table === "profiles") {
          const profileCallCount = { value: 0 };
          // Could be verifyLeavingAuthority or fetch employee name or fetch HR admins
          c.in.mockResolvedValue({
            data: opts?.authorised !== false
              ? [{ id: "user-123", is_hr_admin: true, line_manager_id: null }]
              : [{ id: "user-123", is_hr_admin: false, line_manager_id: null }],
            error: null,
          });
          c.single.mockResolvedValue({
            data: { full_name: "John Smith" },
            error: null,
          });
          // HR admins fetch
          c.eq.mockImplementation(() => {
            profileCallCount.value++;
            return c;
          });
          // For the last .eq("status", "active") call, resolve with HR admins
          c.order.mockResolvedValue({ data: [], error: null });
          return c;
        }
        if (table === "notifications") {
          c.insert.mockResolvedValue({
            error: opts?.notifError ? { message: "Notification failed" } : null,
          });
          return c;
        }
        return c;
      });
    }

    it("submits a draft form successfully", async () => {
      setupSubmitChain();

      const result = await submitLeavingForm("form-1");
      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/leaving");
    });

    it("returns error when form not found", async () => {
      setupSubmitChain({ formData: null });

      const result = await submitLeavingForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("returns error when form is not draft", async () => {
      setupSubmitChain({ formStatus: "submitted" });

      const result = await submitLeavingForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("already been submitted");
    });

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await submitLeavingForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Not authenticated");
    });
  });

  // =============================================
  // startProcessingForm
  // =============================================

  describe("startProcessingForm", () => {
    function setupStartProcessingChain(opts?: {
      formData?: Record<string, unknown> | null;
      updateError?: boolean;
    }) {
      const formCallCount = { value: 0 };
      mockFrom.mockImplementation((table: string) => {
        const c = chainable();
        formCallCount.value++;
        if (formCallCount.value === 1) {
          // Fetch form
          c.single.mockResolvedValue({
            data: opts?.formData !== undefined
              ? opts.formData
              : { id: "form-1", profile_id: "emp-456", status: "submitted" },
            error: null,
          });
        } else {
          // Update status
          c.single.mockResolvedValue(
            opts?.updateError
              ? { data: null, error: { message: "Update failed" } }
              : { data: { id: "form-1" }, error: null },
          );
        }
        return c;
      });
    }

    it("starts processing a submitted form", async () => {
      setupStartProcessingChain();

      const result = await startProcessingForm("form-1");
      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/leaving");
    });

    it("returns error when form not found", async () => {
      setupStartProcessingChain({ formData: null });

      const result = await startProcessingForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("returns error when form is not submitted", async () => {
      setupStartProcessingChain({
        formData: { id: "form-1", profile_id: "emp-456", status: "draft" },
      });

      const result = await startProcessingForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("submitted");
    });

    it("throws when user is not HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValue(new Error("Not authorised"));
      await expect(startProcessingForm("form-1")).rejects.toThrow("Not authorised");
    });
  });

  // =============================================
  // completeLeavingForm
  // =============================================

  describe("completeLeavingForm", () => {
    function setupCompleteChain(opts?: {
      formData?: Record<string, unknown> | null;
      formUpdateError?: boolean;
      historyError?: boolean;
      profileError?: boolean;
    }) {
      const callLog: string[] = [];
      mockFrom.mockImplementation((table: string) => {
        const c = chainable();
        callLog.push(table);

        if (table === "staff_leaving_forms") {
          const formCalls = callLog.filter((t) => t === "staff_leaving_forms").length;
          if (formCalls === 1) {
            // Fetch form
            c.single.mockResolvedValue({
              data: opts?.formData !== undefined
                ? opts.formData
                : {
                    id: "form-1",
                    profile_id: "emp-456",
                    status: "in_progress",
                    leaving_date: "2026-06-30",
                    reason_for_leaving: "resignation",
                    additional_notes: "Good luck",
                    initiated_by: "mgr-789",
                  },
              error: null,
            });
          } else {
            // Update (complete or rollback)
            c.single.mockResolvedValue(
              opts?.formUpdateError
                ? { data: null, error: { message: "Form update failed" } }
                : { data: { id: "form-1" }, error: null },
            );
          }
          return c;
        }
        if (table === "employment_history") {
          c.single.mockResolvedValue(
            opts?.historyError
              ? { data: null, error: { message: "History insert failed" } }
              : { data: { id: "history-1" }, error: null },
          );
          return c;
        }
        if (table === "profiles") {
          const profileCalls = callLog.filter((t) => t === "profiles").length;
          if (profileCalls === 1) {
            // Update profile status
            c.single.mockResolvedValue(
              opts?.profileError
                ? { data: null, error: { message: "Profile update failed" } }
                : { data: { id: "emp-456" }, error: null },
            );
          } else {
            // Fetch employee name for notification
            c.single.mockResolvedValue({
              data: { full_name: "John Smith" },
              error: null,
            });
          }
          return c;
        }
        if (table === "notifications") {
          c.insert.mockResolvedValue({ error: null });
          return c;
        }
        return c;
      });
    }

    it("completes a leaving form successfully", async () => {
      setupCompleteChain();

      const result = await completeLeavingForm("form-1");
      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/leaving");
    });

    it("returns error when form not found", async () => {
      setupCompleteChain({ formData: null });

      const result = await completeLeavingForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("returns error when form is not in_progress", async () => {
      setupCompleteChain({
        formData: {
          id: "form-1",
          profile_id: "emp-456",
          status: "draft",
          leaving_date: "2026-06-30",
          reason_for_leaving: "resignation",
          additional_notes: null,
          initiated_by: null,
        },
      });

      const result = await completeLeavingForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("in progress");
    });

    it("rolls back form when employment history insert fails", async () => {
      setupCompleteChain({ historyError: true });

      const result = await completeLeavingForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("employment history");
    });

    it("rolls back form and history when profile update fails", async () => {
      setupCompleteChain({ profileError: true });

      const result = await completeLeavingForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("profile status");
    });

    it("throws when user is not HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValue(new Error("Not authorised"));
      await expect(completeLeavingForm("form-1")).rejects.toThrow("Not authorised");
    });
  });

  // =============================================
  // cancelLeavingForm
  // =============================================

  describe("cancelLeavingForm", () => {
    function setupCancelChain(opts?: {
      formData?: Record<string, unknown> | null;
      updateError?: boolean;
    }) {
      const formCallCount = { value: 0 };
      mockFrom.mockImplementation(() => {
        const c = chainable();
        formCallCount.value++;
        if (formCallCount.value === 1) {
          c.single.mockResolvedValue({
            data: opts?.formData !== undefined
              ? opts.formData
              : { id: "form-1", profile_id: "emp-456", status: "draft" },
            error: null,
          });
        } else {
          c.single.mockResolvedValue(
            opts?.updateError
              ? { data: null, error: { message: "Cancel failed" } }
              : { data: { id: "form-1" }, error: null },
          );
        }
        return c;
      });
    }

    it("cancels a draft form", async () => {
      setupCancelChain();

      const result = await cancelLeavingForm("form-1");
      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/leaving");
    });

    it("cancels a submitted form", async () => {
      setupCancelChain({
        formData: { id: "form-1", profile_id: "emp-456", status: "submitted" },
      });

      const result = await cancelLeavingForm("form-1");
      expect(result.success).toBe(true);
    });

    it("cancels an in_progress form", async () => {
      setupCancelChain({
        formData: { id: "form-1", profile_id: "emp-456", status: "in_progress" },
      });

      const result = await cancelLeavingForm("form-1");
      expect(result.success).toBe(true);
    });

    it("returns error for completed form", async () => {
      setupCancelChain({
        formData: { id: "form-1", profile_id: "emp-456", status: "completed" },
      });

      const result = await cancelLeavingForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot cancel a completed");
    });

    it("returns error for already cancelled form", async () => {
      setupCancelChain({
        formData: { id: "form-1", profile_id: "emp-456", status: "cancelled" },
      });

      const result = await cancelLeavingForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("already cancelled");
    });

    it("returns error when form not found", async () => {
      setupCancelChain({ formData: null });

      const result = await cancelLeavingForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // =============================================
  // fetchLeavingFormSummary
  // =============================================

  describe("fetchLeavingFormSummary", () => {
    it("returns empty data when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await fetchLeavingFormSummary("emp-456");
      expect(result.outstandingAssets).toEqual([]);
      expect(result.activeComplianceDocs).toEqual([]);
      expect(result.leaveBalance).toBeNull();
    });

    it("returns empty data when not authorised", async () => {
      mockFrom.mockImplementation((table: string) => {
        const c = chainable();
        if (table === "profiles") {
          // verifyLeavingAuthority — user is neither admin nor manager
          c.in.mockResolvedValue({
            data: [
              { id: "user-123", is_hr_admin: false, line_manager_id: null },
              { id: "emp-456", is_hr_admin: false, line_manager_id: "other-mgr" },
            ],
            error: null,
          });
        }
        return c;
      });

      const result = await fetchLeavingFormSummary("emp-456");
      expect(result.outstandingAssets).toEqual([]);
    });
  });
});
