import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Test strategy for absence actions:
 *
 * Mock `@/lib/auth` (requireHRAdmin / getCurrentUser) — same pattern as
 * users/actions.test.ts. Each action uses different Supabase chain patterns:
 *
 *   recordAbsence: requireHRAdmin → .from().select().eq().lte().gte().limit()
 *                  → .from().select().eq().single() → .from().insert().select().single()
 *   updateAbsence: requireHRAdmin → .from().update().eq().select().single()
 *   deleteAbsence: requireHRAdmin → .from().select().eq().single() → .from().delete().eq()
 *                  → storage.from().remove()
 *   uploadFitNote: requireHRAdmin → .from().select().eq().single()
 *                  → storage.from().upload() → .from().update().eq()
 *   deleteFitNote: requireHRAdmin → .from().select().eq().single()
 *                  → .from().update().eq() → storage.from().remove()
 *   createRTWForm: getCurrentUser → verifyRTWAuthority → .from().insert().select().single()
 *   saveRTWForm:   getCurrentUser → verifyRTWAuthority → .from().update().eq()
 *   submitRTWForm: getCurrentUser → verifyRTWAuthority → .from().update().eq().select().single()
 *   confirmRTWForm: getCurrentUser → .from().select().eq().single()
 *                   → .from().update().eq().eq().select().single()
 *   unlockRTWForm: requireHRAdmin → .from().select().eq().single()
 *                  → .from().update().eq()
 *   fetchAbsenceHistory: getCurrentUser → .from().select().eq().order()
 *   fetchRTWForm:  getCurrentUser → .from().select().eq().single()
 *   fetchTriggerPointStatus: getCurrentUser → .from().select().eq().gte()[.neq()]
 *
 * Because these chains are complex and share mockEq/mockSelect across operations,
 * we reset mock return values per-test to avoid cross-contamination.
 */

// ── Hoisted mocks (available inside vi.mock factories) ──

const mockSingle = vi.hoisted(() => vi.fn());
const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockOrder = vi.hoisted(() => vi.fn());
const mockLimit = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockNeq = vi.hoisted(() => vi.fn());
const mockIn = vi.hoisted(() => vi.fn());
const mockLte = vi.hoisted(() => vi.fn());
const mockGte = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

// Storage mocks
const mockStorageUpload = vi.hoisted(() => vi.fn());
const mockStorageRemove = vi.hoisted(() => vi.fn());
const mockStorageFrom = vi.hoisted(() => vi.fn());

const mockSupabase = vi.hoisted(() => ({
  from: mockFrom,
  storage: { from: mockStorageFrom },
}));

// ── Mock modules ──

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

// Mock crypto.randomUUID for fit note storage paths
vi.stubGlobal("crypto", { randomUUID: () => "test-uuid-1234" });

// ── Import modules under test ──

import {
  recordAbsence,
  updateAbsence,
  deleteAbsence,
  uploadFitNote,
  deleteFitNote,
  createRTWForm,
  saveRTWForm,
  submitRTWForm,
  confirmRTWForm,
  unlockRTWForm,
  fetchAbsenceHistory,
  fetchRTWForm,
  fetchTriggerPointStatus,
} from "@/app/(protected)/hr/absence/actions";
import { requireHRAdmin, getCurrentUser } from "@/lib/auth";

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
  chain.delete = vi.fn().mockImplementation(self);
  return chain;
}

// ── Tests ──

describe("HR Absence Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default storage mocks
    mockStorageUpload.mockResolvedValue({ data: { path: "test.pdf" }, error: null });
    mockStorageRemove.mockResolvedValue({ data: null, error: null });
    mockStorageFrom.mockReturnValue({
      upload: mockStorageUpload,
      remove: mockStorageRemove,
    });

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
  // recordAbsence
  // =============================================

  describe("recordAbsence", () => {
    function setupRecordAbsenceChain(opts?: {
      overlapping?: Record<string, unknown>[];
      profileRegion?: string | null;
      holidays?: { holiday_date: string }[];
      insertResult?: { data: unknown; error: unknown };
    }) {
      const calls: { table: string; op: string }[] = [];
      mockFrom.mockImplementation((table: string) => {
        if (table === "absence_records" && calls.filter(c => c.table === "absence_records").length === 0) {
          // First call: overlap check
          calls.push({ table, op: "select-overlap" });
          const c = chainable();
          c.limit.mockResolvedValue({ data: opts?.overlapping ?? [], error: null });
          return c;
        }
        if (table === "profiles") {
          calls.push({ table, op: "select-profile" });
          const c = chainable();
          c.single.mockResolvedValue({
            data: { region: opts?.profileRegion ?? "scotland" },
            error: null,
          });
          return c;
        }
        if (table === "public_holidays") {
          calls.push({ table, op: "select-holidays" });
          const c = chainable();
          c.order.mockResolvedValue({
            data: opts?.holidays ?? [],
            error: null,
          });
          return c;
        }
        // Last absence_records call: insert
        calls.push({ table, op: "insert" });
        const c = chainable();
        c.single.mockResolvedValue(
          opts?.insertResult ?? { data: { id: "absence-new" }, error: null }
        );
        return c;
      });
    }

    it("requires authentication (HR admin)", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValue(new Error("Not authenticated"));

      await expect(
        recordAbsence({
          profile_id: "emp-1",
          absence_type: "sick_self_certified",
          start_date: "2026-03-03",
          end_date: "2026-03-04",
        })
      ).rejects.toThrow("Not authenticated");
    });

    it("returns error for missing required fields", async () => {
      const result = await recordAbsence({
        profile_id: "",
        absence_type: "sick_self_certified",
        start_date: "2026-03-03",
        end_date: "2026-03-04",
      });
      expect(result).toEqual({ success: false, error: "Missing required fields" });
    });

    it("returns error for invalid absence type", async () => {
      const result = await recordAbsence({
        profile_id: "emp-1",
        absence_type: "holiday",
        start_date: "2026-03-03",
        end_date: "2026-03-04",
      });
      expect(result).toEqual({ success: false, error: "Invalid absence type" });
    });

    it("returns error when end date is before start date", async () => {
      const result = await recordAbsence({
        profile_id: "emp-1",
        absence_type: "sick_self_certified",
        start_date: "2026-03-05",
        end_date: "2026-03-03",
      });
      expect(result).toEqual({ success: false, error: "End date cannot be before start date" });
    });

    it("returns error when date range exceeds MAX_ABSENCE_DAYS", async () => {
      const result = await recordAbsence({
        profile_id: "emp-1",
        absence_type: "sick_self_certified",
        start_date: "2024-01-01",
        end_date: "2026-03-04",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("cannot exceed");
    });

    it("returns error for invalid sickness category", async () => {
      setupRecordAbsenceChain();
      const result = await recordAbsence({
        profile_id: "emp-1",
        absence_type: "sick_self_certified",
        start_date: "2026-03-03",
        end_date: "2026-03-04",
        sickness_category: "invalid_category",
      });
      expect(result).toEqual({ success: false, error: "Invalid sickness category" });
    });

    it("returns error when overlapping absence exists", async () => {
      setupRecordAbsenceChain({ overlapping: [{ id: "existing-absence" }] });
      const result = await recordAbsence({
        profile_id: "emp-1",
        absence_type: "sick_self_certified",
        start_date: "2026-03-03",
        end_date: "2026-03-04",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("already has an absence");
    });

    it("returns error when no working days in range", async () => {
      // Saturday and Sunday
      setupRecordAbsenceChain();
      const result = await recordAbsence({
        profile_id: "emp-1",
        absence_type: "sick_self_certified",
        start_date: "2026-03-07",
        end_date: "2026-03-08",
      });
      expect(result).toEqual({ success: false, error: "No working days in the selected date range" });
    });

    it("records absence successfully with valid data", async () => {
      setupRecordAbsenceChain();
      const result = await recordAbsence({
        profile_id: "emp-1",
        absence_type: "sick_self_certified",
        start_date: "2026-03-02",
        end_date: "2026-03-03",
      });
      expect(result.success).toBe(true);
      expect(result.absenceId).toBe("absence-new");
    });

    it("returns error when DB insert fails", async () => {
      setupRecordAbsenceChain({
        insertResult: { data: null, error: { message: "DB insert failed" } },
      });
      const result = await recordAbsence({
        profile_id: "emp-1",
        absence_type: "sick_self_certified",
        start_date: "2026-03-02",
        end_date: "2026-03-03",
      });
      expect(result).toEqual({ success: false, error: "Failed to record absence. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." });
    });

    it("accepts valid sickness categories", async () => {
      setupRecordAbsenceChain();
      const result = await recordAbsence({
        profile_id: "emp-1",
        absence_type: "sick_self_certified",
        start_date: "2026-03-02",
        end_date: "2026-03-03",
        sickness_category: "mental_health",
      });
      expect(result.success).toBe(true);
    });
  });

  // =============================================
  // updateAbsence
  // =============================================

  describe("updateAbsence", () => {
    it("returns error when no valid fields provided", async () => {
      const result = await updateAbsence("abs-1", { leave_request_id: "ignored" });
      expect(result).toEqual({ success: false, error: "No valid fields to update" });
    });

    it("returns error for invalid absence type", async () => {
      const result = await updateAbsence("abs-1", { absence_type: "holiday" });
      expect(result).toEqual({ success: false, error: "Invalid absence type" });
    });

    it("returns error for invalid sickness category", async () => {
      const result = await updateAbsence("abs-1", { sickness_category: "fake" });
      expect(result).toEqual({ success: false, error: "Invalid sickness category" });
    });

    it("updates non-date fields without recalculating working days", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: { id: "abs-1", profile_id: "emp-1" }, error: null });
      mockFrom.mockReturnValue(c);

      const result = await updateAbsence("abs-1", { reason: "Updated reason" });
      expect(result).toEqual({ success: true, error: null });
    });

    it("recalculates working days when end_date changes", async () => {
      const callCounts: Record<string, number> = {};
      mockFrom.mockImplementation((table: string) => {
        callCounts[table] = (callCounts[table] ?? 0) + 1;
        const c = chainable();
        if (table === "absence_records" && callCounts[table] === 1) {
          // Fetch existing record
          c.single.mockResolvedValue({
            data: { profile_id: "emp-1", start_date: "2026-03-02" },
            error: null,
          });
        } else if (table === "absence_records" && callCounts[table] === 2) {
          // Overlap check
          c.limit.mockResolvedValue({ data: [], error: null });
        } else if (table === "profiles") {
          c.single.mockResolvedValue({ data: { region: "scotland" }, error: null });
        } else if (table === "public_holidays") {
          c.order.mockResolvedValue({ data: [], error: null });
        } else {
          // Final update
          c.single.mockResolvedValue({ data: { id: "abs-1", profile_id: "emp-1" }, error: null });
        }
        return c;
      });

      const result = await updateAbsence("abs-1", { end_date: "2026-03-04" });
      expect(result).toEqual({ success: true, error: null });
    });

    it("returns error when end_date is before start_date on date change", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { profile_id: "emp-1", start_date: "2026-03-10" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await updateAbsence("abs-1", { end_date: "2026-03-05" });
      expect(result).toEqual({ success: false, error: "End date cannot be before start date" });
    });

    it("returns error when absence record not found for date change", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await updateAbsence("abs-1", { end_date: "2026-03-10" });
      expect(result).toEqual({ success: false, error: "Absence record not found" });
    });

    it("strips leave_request_id from updates", async () => {
      const result = await updateAbsence("abs-1", {
        leave_request_id: "should-be-stripped",
      });
      expect(result).toEqual({ success: false, error: "No valid fields to update" });
    });
  });

  // =============================================
  // deleteAbsence
  // =============================================

  describe("deleteAbsence", () => {
    it("returns error when absence not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await deleteAbsence("abs-nonexistent");
      expect(result).toEqual({ success: false, error: "Absence record not found" });
    });

    it("deletes absence and cleans up fit note from storage", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          // Fetch record
          c.single.mockResolvedValue({
            data: { id: "abs-1", profile_id: "emp-1", fit_note_path: "fit-notes/emp-1/file.pdf" },
            error: null,
          });
        } else {
          // Delete
          c.eq.mockResolvedValue({ error: null });
        }
        return c;
      });

      const result = await deleteAbsence("abs-1");
      expect(result).toEqual({ success: true, error: null });
      expect(mockStorageFrom).toHaveBeenCalledWith("hr-documents");
      expect(mockStorageRemove).toHaveBeenCalledWith(["fit-notes/emp-1/file.pdf"]);
    });

    it("deletes absence without storage cleanup when no fit note", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { id: "abs-1", profile_id: "emp-1", fit_note_path: null },
            error: null,
          });
        } else {
          c.eq.mockResolvedValue({ error: null });
        }
        return c;
      });

      const result = await deleteAbsence("abs-1");
      expect(result).toEqual({ success: true, error: null });
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });

    it("returns error when DB delete fails", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { id: "abs-1", profile_id: "emp-1", fit_note_path: null },
            error: null,
          });
        } else {
          c.eq.mockResolvedValue({ error: { message: "FK constraint" } });
        }
        return c;
      });

      const result = await deleteAbsence("abs-1");
      expect(result).toEqual({ success: false, error: "Failed to delete absence record. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." });
    });
  });

  // =============================================
  // uploadFitNote
  // =============================================

  describe("uploadFitNote", () => {
    function makeFormData(overrides?: Partial<{ absence_id: string; profile_id: string; file: File }>) {
      const fd = new FormData();
      fd.set("absence_id", overrides?.absence_id ?? "00000000-0000-0000-0000-000000000001");
      fd.set("profile_id", overrides?.profile_id ?? "00000000-0000-0000-0000-000000000002");
      fd.set(
        "file",
        overrides?.file ?? new File(["test"], "test.pdf", { type: "application/pdf" })
      );
      return fd;
    }

    it("returns error for missing fields", async () => {
      const fd = new FormData();
      const result = await uploadFitNote(fd);
      expect(result).toEqual({ success: false, error: "Missing required fields" });
    });

    it("returns error for invalid UUID format (path manipulation prevention)", async () => {
      const fd = makeFormData({ profile_id: "../../malicious" });
      const result = await uploadFitNote(fd);
      expect(result).toEqual({ success: false, error: "Invalid ID format" });
    });

    it("returns error for invalid file type", async () => {
      const fd = makeFormData({
        file: new File(["test"], "script.exe", { type: "application/x-msdownload" }),
      });
      const result = await uploadFitNote(fd);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("uploads fit note successfully", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          // Fetch existing fit_note_path
          c.single.mockResolvedValue({ data: { fit_note_path: null }, error: null });
        } else {
          // Update absence record with new path
          c.eq.mockResolvedValue({ error: null });
        }
        return c;
      });

      const fd = makeFormData();
      const result = await uploadFitNote(fd);
      expect(result).toEqual({ success: true, error: null });
      expect(mockStorageUpload).toHaveBeenCalled();
    });

    it("rolls back uploaded file when DB update fails", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.single.mockResolvedValue({ data: { fit_note_path: null }, error: null });
        } else {
          // DB update fails
          c.eq.mockResolvedValue({ error: { message: "DB update failed" } });
        }
        return c;
      });

      const fd = makeFormData();
      const result = await uploadFitNote(fd);
      expect(result).toEqual({ success: false, error: "Failed to save fit note record. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." });
      // Should remove the uploaded file
      expect(mockStorageRemove).toHaveBeenCalled();
    });

    it("returns error when storage upload fails", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: { fit_note_path: null }, error: null });
      mockFrom.mockReturnValue(c);
      mockStorageUpload.mockResolvedValue({ error: { message: "Storage full" } });

      const fd = makeFormData();
      const result = await uploadFitNote(fd);
      expect(result).toEqual({ success: false, error: "Failed to upload fit note. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." });
    });

    it("deletes old fit note after successful replacement", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { fit_note_path: "fit-notes/old/path.pdf" },
            error: null,
          });
        } else {
          c.eq.mockResolvedValue({ error: null });
        }
        return c;
      });

      const fd = makeFormData();
      await uploadFitNote(fd);
      // Should remove the old file
      expect(mockStorageRemove).toHaveBeenCalledWith(["fit-notes/old/path.pdf"]);
    });
  });

  // =============================================
  // deleteFitNote
  // =============================================

  describe("deleteFitNote", () => {
    it("returns error when absence not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await deleteFitNote("abs-1");
      expect(result).toEqual({ success: false, error: "Absence record not found" });
    });

    it("clears DB reference and removes file from storage", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { fit_note_path: "fit-notes/emp-1/note.pdf", profile_id: "emp-1" },
            error: null,
          });
        } else {
          c.eq.mockResolvedValue({ error: null });
        }
        return c;
      });

      const result = await deleteFitNote("abs-1");
      expect(result).toEqual({ success: true, error: null });
      expect(mockStorageRemove).toHaveBeenCalledWith(["fit-notes/emp-1/note.pdf"]);
    });

    it("does not call storage remove when no fit note path", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { fit_note_path: null, profile_id: "emp-1" },
            error: null,
          });
        } else {
          c.eq.mockResolvedValue({ error: null });
        }
        return c;
      });

      const result = await deleteFitNote("abs-1");
      expect(result).toEqual({ success: true, error: null });
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });

    it("returns error when DB update fails", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { fit_note_path: "path.pdf", profile_id: "emp-1" },
            error: null,
          });
        } else {
          c.eq.mockResolvedValue({ error: { message: "Update failed" } });
        }
        return c;
      });

      const result = await deleteFitNote("abs-1");
      expect(result).toEqual({ success: false, error: "Failed to delete fit note. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." });
    });
  });

  // =============================================
  // createRTWForm
  // =============================================

  describe("createRTWForm", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await createRTWForm("abs-1");
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when absence not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await createRTWForm("abs-nonexistent");
      expect(result).toEqual({ success: false, error: "Absence record not found" });
    });

    it("returns error when user is not authorised (not manager or HR admin)", async () => {
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        const c = chainable();
        if (table === "absence_records") {
          c.single.mockResolvedValue({
            data: {
              id: "abs-1",
              profile_id: "emp-1",
              start_date: "2026-03-01",
              end_date: "2026-03-05",
            },
            error: null,
          });
        } else if (table === "profiles") {
          // verifyRTWAuthority — returns profiles without HR admin or manager match
          c.in.mockResolvedValue({
            data: [
              { id: "user-123", is_hr_admin: false, line_manager_id: null },
              { id: "emp-1", is_hr_admin: false, line_manager_id: "someone-else" },
            ],
            error: null,
          });
        }
        return c;
      });

      const result = await createRTWForm("abs-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not authorised");
    });

    it("returns existing form ID when RTW form already exists", async () => {
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        const c = chainable();
        if (table === "absence_records") {
          c.single.mockResolvedValue({
            data: {
              id: "abs-1",
              profile_id: "emp-1",
              start_date: "2026-03-01",
              end_date: "2026-03-05",
            },
            error: null,
          });
        } else if (table === "profiles") {
          // verifyRTWAuthority — HR admin
          c.in.mockResolvedValue({
            data: [{ id: "user-123", is_hr_admin: true, line_manager_id: null }],
            error: null,
          });
        } else if (table === "return_to_work_forms" && callCount <= 4) {
          // Existing form check
          c.maybeSingle.mockResolvedValue({ data: { id: "existing-rtw" }, error: null });
        }
        return c;
      });

      const result = await createRTWForm("abs-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
      expect(result.formId).toBe("existing-rtw");
    });

    it("creates RTW form successfully for line manager", async () => {
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        const c = chainable();
        if (table === "absence_records" && callCount <= 2) {
          c.single.mockResolvedValue({
            data: {
              id: "abs-1",
              profile_id: "emp-1",
              start_date: "2026-03-01",
              end_date: "2026-03-05",
            },
            error: null,
          });
          // Also handle the select chain for history query
          c.gte.mockResolvedValue({ data: [], error: null });
        } else if (table === "profiles") {
          // verifyRTWAuthority — user is line manager
          c.in.mockResolvedValue({
            data: [
              { id: "user-123", is_hr_admin: false, line_manager_id: null },
              { id: "emp-1", is_hr_admin: false, line_manager_id: "user-123" },
            ],
            error: null,
          });
        } else if (table === "return_to_work_forms") {
          // Check existing — none
          c.maybeSingle.mockResolvedValue({ data: null, error: null });
          // Insert
          c.single.mockResolvedValue({ data: { id: "new-rtw-1" }, error: null });
        } else if (table === "absence_records") {
          // History query
          c.neq.mockResolvedValue({ data: [], error: null });
        }
        return c;
      });

      const result = await createRTWForm("abs-1");
      expect(result.success).toBe(true);
      expect(result.formId).toBe("new-rtw-1");
    });
  });

  // =============================================
  // saveRTWForm
  // =============================================

  describe("saveRTWForm", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await saveRTWForm("form-1", { reason_for_absence: "Flu" });
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when form not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await saveRTWForm("form-nonexistent", { reason_for_absence: "Flu" });
      expect(result).toEqual({ success: false, error: "RTW form not found" });
    });

    it("returns error when form is not in draft state", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "form-1", employee_id: "emp-1", completed_by: "user-123", status: "submitted" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await saveRTWForm("form-1", { reason_for_absence: "Flu" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("no longer editable");
    });

    it("returns error when no valid fields provided", async () => {
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        const c = chainable();
        if (table === "return_to_work_forms") {
          c.single.mockResolvedValue({
            data: { id: "form-1", employee_id: "emp-1", completed_by: "user-123", status: "draft" },
            error: null,
          });
        } else if (table === "profiles") {
          // verifyRTWAuthority — HR admin
          c.in.mockResolvedValue({
            data: [{ id: "user-123", is_hr_admin: true, line_manager_id: null }],
            error: null,
          });
        }
        return c;
      });

      const result = await saveRTWForm("form-1", { invalid_field: "test" });
      expect(result).toEqual({ success: false, error: "No valid fields to update" });
    });

    it("saves valid fields to draft form", async () => {
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        const c = chainable();
        if (table === "return_to_work_forms" && callCount === 1) {
          // Fetch form (select chain)
          c.single.mockResolvedValue({
            data: { id: "form-1", employee_id: "emp-1", completed_by: "user-123", status: "draft" },
            error: null,
          });
        } else if (table === "profiles") {
          // verifyRTWAuthority
          c.in.mockResolvedValue({
            data: [{ id: "user-123", is_hr_admin: true, line_manager_id: null }],
            error: null,
          });
        } else {
          // Update form (terminal .eq())
          c.eq.mockResolvedValue({ error: null });
        }
        return c;
      });

      const result = await saveRTWForm("form-1", {
        reason_for_absence: "Flu",
        is_work_related: false,
      });
      expect(result).toEqual({ success: true, error: null });
    });
  });

  // =============================================
  // submitRTWForm
  // =============================================

  describe("submitRTWForm", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await submitRTWForm("form-1");
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when form not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await submitRTWForm("form-nonexistent");
      expect(result).toEqual({ success: false, error: "RTW form not found" });
    });

    it("returns error when form already submitted", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "form-1", employee_id: "emp-1", completed_by: "user-123", status: "submitted", reason_for_absence: "Flu", absence_record_id: "abs-1" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await submitRTWForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("already been submitted");
    });

    it("returns error when reason_for_absence is missing", async () => {
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        const c = chainable();
        if (table === "return_to_work_forms") {
          c.single.mockResolvedValue({
            data: { id: "form-1", employee_id: "emp-1", completed_by: "user-123", status: "draft", reason_for_absence: null, absence_record_id: "abs-1" },
            error: null,
          });
        } else if (table === "profiles") {
          c.in.mockResolvedValue({
            data: [{ id: "user-123", is_hr_admin: true, line_manager_id: null }],
            error: null,
          });
        }
        return c;
      });

      const result = await submitRTWForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Reason for absence is required");
    });
  });

  // =============================================
  // confirmRTWForm
  // =============================================

  describe("confirmRTWForm", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await confirmRTWForm("form-1");
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when form not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await confirmRTWForm("form-1");
      expect(result).toEqual({ success: false, error: "RTW form not found" });
    });

    it("returns error when user is not the employee", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "form-1", employee_id: "someone-else", status: "submitted" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await confirmRTWForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("only confirm your own");
    });

    it("returns error when form is not in submitted state", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "form-1", employee_id: "user-123", status: "draft" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await confirmRTWForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not awaiting your confirmation");
    });

    it("confirms form successfully", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          // Fetch form
          c.single.mockResolvedValue({
            data: { id: "form-1", employee_id: "user-123", status: "submitted" },
            error: null,
          });
        } else {
          // Update
          c.single.mockResolvedValue({ data: { id: "form-1" }, error: null });
        }
        return c;
      });

      const result = await confirmRTWForm("form-1", "All looks correct");
      expect(result).toEqual({ success: true, error: null });
    });
  });

  // =============================================
  // unlockRTWForm
  // =============================================

  describe("unlockRTWForm", () => {
    it("requires HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValue(new Error("Not authorised"));
      await expect(unlockRTWForm("form-1")).rejects.toThrow("Not authorised");
    });

    it("returns error when form not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await unlockRTWForm("form-nonexistent");
      expect(result).toEqual({ success: false, error: "RTW form not found" });
    });

    it("returns error when form is already in draft state", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "form-1", employee_id: "emp-1", status: "draft" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await unlockRTWForm("form-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("already in draft");
    });

    it("unlocks a locked form successfully", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { id: "form-1", employee_id: "emp-1", status: "locked" },
            error: null,
          });
        } else {
          c.eq.mockResolvedValue({ error: null });
        }
        return c;
      });

      const result = await unlockRTWForm("form-1");
      expect(result).toEqual({ success: true, error: null });
    });

    it("unlocks a submitted form successfully", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { id: "form-1", employee_id: "emp-1", status: "submitted" },
            error: null,
          });
        } else {
          c.eq.mockResolvedValue({ error: null });
        }
        return c;
      });

      const result = await unlockRTWForm("form-1");
      expect(result).toEqual({ success: true, error: null });
    });
  });

  // =============================================
  // fetchAbsenceHistory
  // =============================================

  describe("fetchAbsenceHistory", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await fetchAbsenceHistory("emp-1");
      expect(result).toEqual({ records: [], error: "Not authenticated" });
    });

    it("returns absence records on success", async () => {
      const mockRecords = [
        { id: "abs-1", start_date: "2026-03-01", end_date: "2026-03-03" },
        { id: "abs-2", start_date: "2026-02-01", end_date: "2026-02-05" },
      ];
      const c = chainable();
      c.order.mockResolvedValue({ data: mockRecords, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchAbsenceHistory("emp-1");
      expect(result.error).toBeNull();
      expect(result.records).toEqual(mockRecords);
    });

    it("returns error when query fails", async () => {
      const c = chainable();
      c.order.mockResolvedValue({ data: null, error: { message: "Query failed" } });
      mockFrom.mockReturnValue(c);

      const result = await fetchAbsenceHistory("emp-1");
      expect(result).toEqual({ records: [], error: "Failed to fetch absence history. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." });
    });
  });

  // =============================================
  // fetchRTWForm
  // =============================================

  describe("fetchRTWForm", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await fetchRTWForm("form-1");
      expect(result).toEqual({ form: null, error: "Not authenticated" });
    });

    it("returns form data on success", async () => {
      const mockForm = { id: "form-1", status: "draft", employee_id: "emp-1" };
      const c = chainable();
      c.single.mockResolvedValue({ data: mockForm, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchRTWForm("form-1");
      expect(result.error).toBeNull();
      expect(result.form).toEqual(mockForm);
    });

    it("returns error when query fails", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: { message: "Not found" } });
      mockFrom.mockReturnValue(c);

      const result = await fetchRTWForm("form-1");
      expect(result).toEqual({ form: null, error: "Failed to fetch return-to-work form. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." });
    });
  });

  // =============================================
  // fetchTriggerPointStatus
  // =============================================

  describe("fetchTriggerPointStatus", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await fetchTriggerPointStatus("emp-1");
      expect(result.error).toBe("Not authenticated");
      expect(result.result.reached).toBe(false);
    });

    it("returns trigger point data on success", async () => {
      const c = chainable();
      // The query uses .neq() when excludeAbsenceId is provided, otherwise ends at .gte()
      c.gte.mockResolvedValue({ data: [], error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchTriggerPointStatus("emp-1");
      expect(result.error).toBeNull();
      expect(result.result).toEqual(
        expect.objectContaining({ reached: false })
      );
    });

    it("handles excludeAbsenceId parameter", async () => {
      const c = chainable();
      c.neq.mockResolvedValue({ data: [], error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchTriggerPointStatus("emp-1", "abs-exclude");
      expect(result.error).toBeNull();
    });

    it("returns error when query fails", async () => {
      const c = chainable();
      c.gte.mockResolvedValue({ data: null, error: { message: "Query error" } });
      mockFrom.mockReturnValue(c);

      const result = await fetchTriggerPointStatus("emp-1");
      expect(result.error).toBe("Failed to fetch trigger point status. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.");
    });
  });
});
