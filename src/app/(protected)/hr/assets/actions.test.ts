import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Test strategy for asset actions:
 *
 * All actions require HR admin (requireHRAdmin). Multi-step actions
 * (assignAsset, returnAsset) have rollback logic on failure.
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
  createAsset,
  updateAsset,
  assignAsset,
  returnAsset,
  retireAsset,
} from "@/app/(protected)/hr/assets/actions";
import { requireHRAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── Chainable mock helper ──

function chainable() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.eq = vi.fn().mockImplementation(self);
  chain.is = vi.fn().mockImplementation(self);
  chain.in = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.update = vi.fn().mockImplementation(self);
  chain.insert = vi.fn().mockImplementation(self);
  chain.delete = vi.fn().mockImplementation(self);
  return chain;
}

// ── Tests ──

describe("HR Asset Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireHRAdmin).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "admin-123", email: "admin@mcrpathways.org" } as never,
    });
  });

  // =============================================
  // createAsset
  // =============================================

  describe("createAsset", () => {
    it("creates an asset successfully", async () => {
      const c = chainable();
      c.insert.mockResolvedValue({ error: null });
      mockFrom.mockReturnValue(c);

      const result = await createAsset({
        asset_type_id: "type-1",
        asset_tag: "LAP-001",
        make: "Dell",
        model: "XPS 15",
      });

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith("assets");
      expect(revalidatePath).toHaveBeenCalledWith("/hr/assets");
    });

    it("returns error when asset_type_id is missing", async () => {
      const result = await createAsset({
        asset_type_id: "",
        asset_tag: "LAP-001",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });

    it("returns error when asset_tag is missing", async () => {
      const result = await createAsset({
        asset_type_id: "type-1",
        asset_tag: "",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });

    it("returns error for duplicate asset tag", async () => {
      const c = chainable();
      c.insert.mockResolvedValue({
        error: { message: "duplicate key value violates unique constraint" },
      });
      mockFrom.mockReturnValue(c);

      const result = await createAsset({
        asset_type_id: "type-1",
        asset_tag: "LAP-001",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });

    it("throws when user is not HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValue(new Error("Not authorised"));
      await expect(createAsset({ asset_type_id: "t", asset_tag: "A" })).rejects.toThrow(
        "Not authorised",
      );
    });
  });

  // =============================================
  // updateAsset
  // =============================================

  describe("updateAsset", () => {
    it("updates an asset successfully", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: { id: "asset-1" }, error: null });
      mockFrom.mockReturnValue(c);

      const result = await updateAsset("asset-1", { make: "Lenovo", model: "ThinkPad" });

      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/assets");
    });

    it("returns error when no valid fields provided", async () => {
      const result = await updateAsset("asset-1", {} as Parameters<typeof updateAsset>[1]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No valid fields");
    });

    it("returns error on DB failure", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: { message: "DB error" } });
      mockFrom.mockReturnValue(c);

      const result = await updateAsset("asset-1", { notes: "Updated" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to update asset");
    });

    it("sanitises fields — only allowed fields pass through", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: { id: "asset-1" }, error: null });
      mockFrom.mockReturnValue(c);

      const result = await updateAsset("asset-1", {
        make: "Dell",
        id: "SHOULD_BE_STRIPPED",
      } as Parameters<typeof updateAsset>[1]);

      expect(result.success).toBe(true);
      // Verify allowed field passes through but disallowed "id" is stripped
      expect(c.update).toHaveBeenCalledWith(
        expect.objectContaining({ make: "Dell" }),
      );
      expect(c.update).toHaveBeenCalledWith(
        expect.not.objectContaining({ id: "SHOULD_BE_STRIPPED" }),
      );
    });
  });

  // =============================================
  // assignAsset
  // =============================================

  describe("assignAsset", () => {
    function setupAssignChain(opts?: {
      assetData?: Record<string, unknown> | null;
      assignError?: boolean;
      statusUpdateError?: boolean;
    }) {
      const callLog: string[] = [];
      const deleteTracker = vi.fn();

      mockFrom.mockImplementation((table: string) => {
        callLog.push(table);
        const c = chainable();

        if (table === "assets") {
          const assetCalls = callLog.filter((t) => t === "assets").length;
          if (assetCalls === 1) {
            // Fetch asset status
            const assetData = opts?.assetData !== undefined
              ? opts.assetData
              : { id: "asset-1", status: "available" };
            c.single.mockResolvedValue({ data: assetData, error: null });
          } else {
            // Update asset status
            c.single.mockResolvedValue(
              opts?.statusUpdateError
                ? { data: null, error: { message: "Status update failed" } }
                : { data: { id: "asset-1" }, error: null },
            );
          }
          return c;
        }

        if (table === "asset_assignments") {
          // Insert assignment or rollback delete
          c.single.mockResolvedValue(
            opts?.assignError
              ? { data: null, error: { message: "Assignment failed" } }
              : { data: { id: "assign-1" }, error: null },
          );
          c.delete.mockImplementation(() => {
            deleteTracker();
            return c;
          });
          return c;
        }

        return c;
      });

      return { deleteTracker };
    }

    it("assigns an available asset successfully", async () => {
      setupAssignChain();

      const result = await assignAsset("asset-1", "emp-456", {
        condition_on_assignment: "Good",
      });

      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/assets");
      expect(revalidatePath).toHaveBeenCalledWith("/hr/users/emp-456");
    });

    it("assigns an in_repair asset", async () => {
      setupAssignChain({ assetData: { id: "asset-1", status: "in_repair" } });

      const result = await assignAsset("asset-1", "emp-456", {});
      expect(result.success).toBe(true);
    });

    it("returns error when asset not found", async () => {
      setupAssignChain({ assetData: null });

      const result = await assignAsset("asset-1", "emp-456", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("returns error when asset is already assigned", async () => {
      setupAssignChain({ assetData: { id: "asset-1", status: "assigned" } });

      const result = await assignAsset("asset-1", "emp-456", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot assign");
    });

    it("returns error when asset is retired", async () => {
      setupAssignChain({ assetData: { id: "asset-1", status: "retired" } });

      const result = await assignAsset("asset-1", "emp-456", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot assign");
    });

    it("returns error when assignment insert fails", async () => {
      setupAssignChain({ assignError: true });

      const result = await assignAsset("asset-1", "emp-456", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to assign asset");
    });

    it("rolls back assignment when status update fails", async () => {
      const { deleteTracker } = setupAssignChain({ statusUpdateError: true });

      const result = await assignAsset("asset-1", "emp-456", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to assign asset");
      // Verify rollback — delete was called on asset_assignments
      expect(deleteTracker).toHaveBeenCalled();
    });
  });

  // =============================================
  // returnAsset
  // =============================================

  describe("returnAsset", () => {
    function setupReturnChain(opts?: {
      assignmentData?: Record<string, unknown> | null;
      returnError?: boolean;
      statusUpdateError?: boolean;
    }) {
      const callLog: string[] = [];
      const rollbackTracker = vi.fn();

      mockFrom.mockImplementation((table: string) => {
        callLog.push(table);
        const c = chainable();

        if (table === "asset_assignments") {
          const assignCalls = callLog.filter((t) => t === "asset_assignments").length;
          if (assignCalls === 1) {
            // Fetch assignment
            const assignData = opts?.assignmentData !== undefined
              ? opts.assignmentData
              : { id: "assign-1", asset_id: "asset-1", profile_id: "emp-456" };
            c.single.mockResolvedValue({ data: assignData, error: null });
          } else {
            // Update assignment with return info or rollback
            c.update.mockImplementation((...args: unknown[]) => {
              const updateData = args[0] as Record<string, unknown> | undefined;
              // Track rollback calls (returned_date set back to null)
              if (updateData?.returned_date === null) {
                rollbackTracker();
              }
              return c;
            });
            c.single.mockResolvedValue(
              opts?.returnError
                ? { data: null, error: { message: "Return update failed" } }
                : { data: { id: "assign-1" }, error: null },
            );
          }
          return c;
        }

        if (table === "assets") {
          // Update asset status to available
          c.single.mockResolvedValue(
            opts?.statusUpdateError
              ? { data: null, error: { message: "Status update failed" } }
              : { data: { id: "asset-1" }, error: null },
          );
          return c;
        }

        return c;
      });
      return { rollbackTracker };
    }

    it("returns an asset successfully", async () => {
      setupReturnChain();

      const result = await returnAsset("assign-1", {
        condition_on_return: "Good",
        notes: "Returned in good condition",
      });

      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/assets");
      expect(revalidatePath).toHaveBeenCalledWith("/hr/users/emp-456");
    });

    it("returns error when assignment not found", async () => {
      setupReturnChain({ assignmentData: null });

      const result = await returnAsset("assign-1", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("returns error when return update fails", async () => {
      setupReturnChain({ returnError: true });

      const result = await returnAsset("assign-1", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to return asset");
    });

    it("rolls back when asset status update fails", async () => {
      const { rollbackTracker } = setupReturnChain({ statusUpdateError: true });

      const result = await returnAsset("assign-1", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to return asset");
      // Verify rollback reverted returned_date and condition_on_return
      expect(rollbackTracker).toHaveBeenCalled();
    });
  });

  // =============================================
  // retireAsset
  // =============================================

  describe("retireAsset", () => {
    function setupRetireChain(opts?: {
      activeAssignments?: unknown[];
      updateError?: boolean;
    }) {
      const callLog: string[] = [];
      mockFrom.mockImplementation((table: string) => {
        callLog.push(table);
        const c = chainable();

        if (table === "asset_assignments") {
          c.limit.mockResolvedValue({
            data: opts?.activeAssignments ?? [],
            error: null,
          });
          return c;
        }

        if (table === "assets") {
          c.single.mockResolvedValue(
            opts?.updateError
              ? { data: null, error: { message: "Retire failed" } }
              : { data: { id: "asset-1" }, error: null },
          );
          return c;
        }

        return c;
      });
    }

    it("retires an unassigned asset", async () => {
      setupRetireChain();

      const result = await retireAsset("asset-1");
      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/assets");
    });

    it("returns error when asset is currently assigned", async () => {
      setupRetireChain({ activeAssignments: [{ id: "assign-1" }] });

      const result = await retireAsset("asset-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("currently assigned");
    });

    it("returns error on DB failure", async () => {
      setupRetireChain({ updateError: true });

      const result = await retireAsset("asset-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to retire asset");
    });

    it("throws when user is not HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValue(new Error("Not authorised"));
      await expect(retireAsset("asset-1")).rejects.toThrow("Not authorised");
    });
  });
});
