import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Test strategy for compliance actions:
 *
 * - calculateDocumentStatus: pure date logic (async but no DB)
 * - uploadComplianceDocument: HR admin, file validation, storage + DB insert, rollback on DB failure
 * - updateComplianceDocument: HR admin, whitelist, auto-recalculates status on expiry change
 * - verifyComplianceDocument: HR admin, sets verified_by/verified_at
 * - deleteComplianceDocument: HR admin, DB-first then storage cleanup
 * - getComplianceDocumentUrl: ownership check (user owns doc OR is HR admin)
 */

// ── Hoisted mocks ──

const mockFrom = vi.hoisted(() => vi.fn());
const mockStorageUpload = vi.hoisted(() => vi.fn());
const mockStorageRemove = vi.hoisted(() => vi.fn());
const mockStorageCreateSignedUrl = vi.hoisted(() => vi.fn());
const mockStorageFrom = vi.hoisted(() => vi.fn());

const mockSupabase = vi.hoisted(() => ({
  from: mockFrom,
  storage: { from: mockStorageFrom },
}));

vi.mock("@/lib/auth", () => ({
  requireHRAdmin: vi.fn().mockResolvedValue({
    supabase: mockSupabase,
    user: { id: "admin-123", email: "admin@mcrpathways.org" },
  }),
  getCurrentUser: vi.fn().mockResolvedValue({
    supabase: mockSupabase,
    user: { id: "user-123", email: "user@mcrpathways.org" },
    profile: { id: "user-123", is_hr_admin: false },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.stubGlobal("crypto", { randomUUID: () => "test-uuid-1234" });

// ── Import modules under test ──

import {
  calculateDocumentStatus,
  uploadComplianceDocument,
  updateComplianceDocument,
  verifyComplianceDocument,
  deleteComplianceDocument,
  getComplianceDocumentUrl,
} from "@/app/(protected)/hr/compliance/actions";
import { requireHRAdmin, getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── Chainable mock helper ──

function chainable() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.eq = vi.fn().mockImplementation(self);
  chain.in = vi.fn().mockImplementation(self);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.update = vi.fn().mockImplementation(self);
  chain.insert = vi.fn().mockImplementation(self);
  chain.delete = vi.fn().mockImplementation(self);
  return chain;
}

// ── Tests ──

describe("HR Compliance Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockStorageUpload.mockResolvedValue({ data: { path: "test.pdf" }, error: null });
    mockStorageRemove.mockResolvedValue({ data: null, error: null });
    mockStorageCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed-url" },
      error: null,
    });
    mockStorageFrom.mockReturnValue({
      upload: mockStorageUpload,
      remove: mockStorageRemove,
      createSignedUrl: mockStorageCreateSignedUrl,
    });

    vi.mocked(requireHRAdmin).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "admin-123", email: "admin@mcrpathways.org" } as never,
    });

    vi.mocked(getCurrentUser).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "user-123", email: "user@mcrpathways.org" } as never,
      profile: { id: "user-123", is_hr_admin: false } as never,
    });
  });

  // =============================================
  // calculateDocumentStatus
  // =============================================

  describe("calculateDocumentStatus", () => {
    it("returns 'valid' when no expiry date", async () => {
      expect(await calculateDocumentStatus(null)).toBe("valid");
    });

    it("returns 'expired' for past date", async () => {
      expect(await calculateDocumentStatus("2020-01-01")).toBe("expired");
    });

    it("returns 'expiring_soon' for date within 90 days", async () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 30);
      const dateStr = soon.toISOString().slice(0, 10);
      expect(await calculateDocumentStatus(dateStr)).toBe("expiring_soon");
    });

    it("returns 'valid' for date more than 90 days away", async () => {
      const future = new Date();
      future.setDate(future.getDate() + 180);
      const dateStr = future.toISOString().slice(0, 10);
      expect(await calculateDocumentStatus(dateStr)).toBe("valid");
    });

    it("returns 'expiring_soon' for date exactly 90 days away", async () => {
      const exactly90 = new Date();
      exactly90.setHours(0, 0, 0, 0);
      exactly90.setDate(exactly90.getDate() + 90);
      const dateStr = exactly90.toISOString().slice(0, 10);
      expect(await calculateDocumentStatus(dateStr)).toBe("expiring_soon");
    });
  });

  // =============================================
  // uploadComplianceDocument
  // =============================================

  describe("uploadComplianceDocument", () => {
    function createFormData(overrides?: Record<string, string | File | null>) {
      const fd = new FormData();
      fd.set("profile_id", overrides?.profile_id as string ?? "emp-456");
      fd.set("document_type_id", overrides?.document_type_id as string ?? "type-1");
      fd.set("reference_number", overrides?.reference_number as string ?? "REF-001");
      fd.set("issue_date", overrides?.issue_date as string ?? "2026-01-15");
      fd.set("expiry_date", overrides?.expiry_date as string ?? "2028-01-15");
      fd.set("notes", overrides?.notes as string ?? "");
      if (overrides?.file !== undefined) {
        if (overrides.file !== null) {
          fd.set("file", overrides.file);
        }
      } else {
        fd.set("file", new File(["pdf content"], "doc.pdf", { type: "application/pdf" }));
      }
      return fd;
    }

    it("uploads a document with file successfully", async () => {
      const c = chainable();
      c.insert.mockResolvedValue({ error: null });
      mockFrom.mockReturnValue(c);

      const result = await uploadComplianceDocument(createFormData());

      expect(result.success).toBe(true);
      expect(mockStorageUpload).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/hr/compliance");
    });

    it("uploads a document without file", async () => {
      const c = chainable();
      c.insert.mockResolvedValue({ error: null });
      mockFrom.mockReturnValue(c);

      const fd = createFormData({ file: null });
      const result = await uploadComplianceDocument(fd);

      expect(result.success).toBe(true);
      expect(mockStorageUpload).not.toHaveBeenCalled();
    });

    it("returns error when profile_id missing", async () => {
      const fd = createFormData({ profile_id: "" });
      const result = await uploadComplianceDocument(fd);

      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });

    it("returns error when document_type_id missing", async () => {
      const fd = createFormData({ document_type_id: "" });
      const result = await uploadComplianceDocument(fd);

      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });

    it("cleans up storage file when DB insert fails", async () => {
      const c = chainable();
      c.insert.mockResolvedValue({ error: { message: "Insert failed" } });
      mockFrom.mockReturnValue(c);

      const result = await uploadComplianceDocument(createFormData());

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to save document record");
      // Storage cleanup should have been called
      expect(mockStorageRemove).toHaveBeenCalled();
    });

    it("returns error for invalid file type", async () => {
      const badFile = new File(["exe content"], "malware.exe", { type: "application/x-executable" });
      const fd = createFormData({ file: badFile as File });

      const result = await uploadComplianceDocument(fd);
      expect(result.success).toBe(false);
    });
  });

  // =============================================
  // updateComplianceDocument
  // =============================================

  describe("updateComplianceDocument", () => {
    function setupUpdateChain(opts?: {
      profileId?: string;
      updateError?: boolean;
    }) {
      const callLog: string[] = [];
      const updatePayloadTracker = vi.fn();
      mockFrom.mockImplementation((table: string) => {
        callLog.push(table);
        const c = chainable();
        const docCalls = callLog.filter((t) => t === "compliance_documents").length;
        if (docCalls === 1) {
          // Fetch profile_id
          c.single.mockResolvedValue({
            data: { profile_id: opts?.profileId ?? "emp-456" },
            error: null,
          });
        } else {
          // Update — track the payload
          c.update.mockImplementation((payload: unknown) => {
            updatePayloadTracker(payload);
            return c;
          });
          c.single.mockResolvedValue(
            opts?.updateError
              ? { data: null, error: { message: "Update failed" } }
              : { data: { id: "doc-1" }, error: null },
          );
        }
        return c;
      });
      return { updatePayloadTracker };
    }

    it("updates document metadata", async () => {
      setupUpdateChain();

      const result = await updateComplianceDocument("doc-1", {
        reference_number: "REF-002",
        notes: "Updated",
      });

      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/compliance");
    });

    it("auto-recalculates status when expiry_date changes", async () => {
      const { updatePayloadTracker } = setupUpdateChain();

      const result = await updateComplianceDocument("doc-1", {
        expiry_date: "2020-01-01", // expired
      });

      expect(result.success).toBe(true);
      // Verify the status was auto-recalculated to "expired"
      expect(updatePayloadTracker).toHaveBeenCalledWith(
        expect.objectContaining({ status: "expired", expiry_date: "2020-01-01" }),
      );
    });

    it("returns error when no valid fields provided", async () => {
      const result = await updateComplianceDocument("doc-1", {} as Parameters<typeof updateComplianceDocument>[1]);
      expect(result.success).toBe(false);
      expect(result.error).toContain("No valid fields");
    });
  });

  // =============================================
  // verifyComplianceDocument
  // =============================================

  describe("verifyComplianceDocument", () => {
    it("marks document as verified", async () => {
      const callLog: string[] = [];
      mockFrom.mockImplementation(() => {
        callLog.push("call");
        const c = chainable();
        if (callLog.length === 1) {
          c.single.mockResolvedValue({ data: { profile_id: "emp-456" }, error: null });
        } else {
          c.single.mockResolvedValue({ data: { id: "doc-1" }, error: null });
        }
        return c;
      });

      const result = await verifyComplianceDocument("doc-1");
      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/compliance");
    });

    it("returns error on DB failure", async () => {
      const callLog: string[] = [];
      mockFrom.mockImplementation(() => {
        callLog.push("call");
        const c = chainable();
        if (callLog.length === 1) {
          c.single.mockResolvedValue({ data: { profile_id: "emp-456" }, error: null });
        } else {
          c.single.mockResolvedValue({ data: null, error: { message: "Verify failed" } });
        }
        return c;
      });

      const result = await verifyComplianceDocument("doc-1");
      expect(result.success).toBe(false);
    });
  });

  // =============================================
  // deleteComplianceDocument
  // =============================================

  describe("deleteComplianceDocument", () => {
    function setupDeleteChain(opts?: {
      docData?: Record<string, unknown> | null;
      deleteError?: boolean;
    }) {
      const callLog: string[] = [];
      mockFrom.mockImplementation(() => {
        callLog.push("call");
        const c = chainable();
        if (callLog.length === 1) {
          // Fetch doc
          c.single.mockResolvedValue({
            data: opts?.docData !== undefined
              ? opts.docData
              : { file_path: "emp-456/test.pdf", profile_id: "emp-456" },
            error: null,
          });
        } else {
          // Delete
          c.delete.mockReturnValue({
            eq: vi.fn().mockResolvedValue(
              opts?.deleteError
                ? { error: { message: "Delete failed" } }
                : { error: null },
            ),
          });
        }
        return c;
      });
    }

    it("deletes document and cleans up storage file", async () => {
      setupDeleteChain();

      const result = await deleteComplianceDocument("doc-1");
      expect(result.success).toBe(true);
      expect(mockStorageRemove).toHaveBeenCalledWith(["emp-456/test.pdf"]);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/compliance");
    });

    it("returns error when document not found", async () => {
      setupDeleteChain({ docData: null });

      const result = await deleteComplianceDocument("doc-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("skips storage cleanup when no file_path", async () => {
      setupDeleteChain({ docData: { file_path: null, profile_id: "emp-456" } });

      const result = await deleteComplianceDocument("doc-1");
      expect(result.success).toBe(true);
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });

    it("returns error on DB delete failure", async () => {
      setupDeleteChain({ deleteError: true });

      const result = await deleteComplianceDocument("doc-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to delete document");
      // Storage should NOT be cleaned up since DB delete failed
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });
  });

  // =============================================
  // getComplianceDocumentUrl
  // =============================================

  describe("getComplianceDocumentUrl", () => {
    it("returns signed URL for document owner", async () => {
      const result = await getComplianceDocumentUrl("user-123/test-uuid.pdf");

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://example.com/signed-url");
      expect(mockStorageCreateSignedUrl).toHaveBeenCalledWith("user-123/test-uuid.pdf", 3600);
    });

    it("returns signed URL for HR admin (non-owner)", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: { id: "admin-123", email: "admin@mcrpathways.org" } as never,
        profile: { id: "admin-123", is_hr_admin: true } as never,
      });

      const result = await getComplianceDocumentUrl("emp-456/test-uuid.pdf");

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://example.com/signed-url");
    });

    it("denies access to non-owner non-admin", async () => {
      const result = await getComplianceDocumentUrl("other-user/test-uuid.pdf");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access denied");
      expect(result.url).toBeNull();
    });

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await getComplianceDocumentUrl("user-123/test.pdf");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Not authenticated");
    });
  });
});
