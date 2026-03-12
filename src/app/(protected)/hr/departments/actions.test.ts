import { describe, it, expect, vi, beforeEach } from "vitest";

// =============================================
// MOCKS
// =============================================

const requireHRAdmin = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireHRAdmin: () => requireHRAdmin(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createDepartment,
  updateDepartment,
  toggleDepartmentActive,
} from "./actions";

// =============================================
// HELPERS
// =============================================

function createMockSupabase() {
  const mockEq = vi.fn();
  const mockSingle = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockSelect = vi.fn();

  // Chain: .from().insert()
  // Chain: .from().update().eq()
  // Chain: .from().select().eq().single()
  // Chain: .from().select("id", {count}).eq().eq()

  const from = vi.fn();

  return {
    supabase: { from },
    from,
    mockInsert,
    mockUpdate,
    mockEq,
    mockSingle,
    mockSelect,
  };
}

describe("Department Actions", () => {
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mock = createMockSupabase();
    requireHRAdmin.mockResolvedValue({ supabase: mock.supabase });
  });

  // =============================================
  // createDepartment
  // =============================================

  describe("createDepartment", () => {
    it("requires HR admin", async () => {
      requireHRAdmin.mockRejectedValue(new Error("Unauthorised"));

      const result = await createDepartment({
        name: "Test",
        slug: "test",
        colour: "#000",
        sort_order: 1,
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to create department. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
      });
    });

    it("creates department with trimmed values", async () => {
      mock.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await createDepartment({
        name: "  New Dept  ",
        slug: "  NEW_DEPT  ",
        colour: "#ff0000",
        sort_order: 5,
      });

      expect(result).toEqual({ success: true });
      expect(mock.from).toHaveBeenCalledWith("departments");
      const insertCall = mock.from.mock.results[0].value.insert;
      expect(insertCall).toHaveBeenCalledWith({
        name: "New Dept",
        slug: "new_dept",
        colour: "#ff0000",
        sort_order: 5,
      });
    });

    it("returns error on duplicate slug", async () => {
      mock.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          error: { code: "23505", message: "duplicate" },
        }),
      });

      const result = await createDepartment({
        name: "Duplicate",
        slug: "existing",
        colour: "#000",
        sort_order: 1,
      });

      expect(result).toEqual({
        success: false,
        error: "A department with this slug already exists",
      });
    });

    it("returns generic error for other DB errors", async () => {
      mock.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          error: { code: "42000", message: "Some DB error" },
        }),
      });

      const result = await createDepartment({
        name: "Test",
        slug: "test",
        colour: "#000",
        sort_order: 1,
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to create department. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
      });
    });
  });

  // =============================================
  // updateDepartment
  // =============================================

  describe("updateDepartment", () => {
    it("requires HR admin", async () => {
      requireHRAdmin.mockRejectedValue(new Error("Unauthorised"));

      const result = await updateDepartment("dept-1", { name: "Updated" });

      expect(result).toEqual({
        success: false,
        error: "Failed to update department. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
      });
    });

    it("updates department with whitelisted fields", async () => {
      const mockUpdateFn = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mock.from.mockReturnValue({
        update: mockUpdateFn,
      });

      const result = await updateDepartment("dept-1", {
        name: "  Updated Name  ",
        colour: "#00ff00",
      });

      expect(result).toEqual({ success: true });
      expect(mockUpdateFn).toHaveBeenCalledWith({
        name: "Updated Name",
        colour: "#00ff00",
      });
    });

    it("returns error when no fields to update", async () => {
      const result = await updateDepartment("dept-1", {});

      expect(result).toEqual({
        success: false,
        error: "No fields to update",
      });
    });

    it("returns error on duplicate slug", async () => {
      mock.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { code: "23505", message: "duplicate" },
          }),
        }),
      });

      const result = await updateDepartment("dept-1", { slug: "existing" });

      expect(result).toEqual({
        success: false,
        error: "A department with this slug already exists",
      });
    });
  });

  // =============================================
  // toggleDepartmentActive
  // =============================================

  describe("toggleDepartmentActive", () => {
    it("requires HR admin", async () => {
      requireHRAdmin.mockRejectedValue(new Error("Unauthorised"));

      const result = await toggleDepartmentActive("dept-1");

      expect(result).toEqual({
        success: false,
        error: "Failed to update department status. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
      });
    });

    it("returns error when department not found", async () => {
      mock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Not found" },
            }),
          }),
        }),
      });

      const result = await toggleDepartmentActive("nonexistent");

      expect(result).toEqual({
        success: false,
        error: "Department not found",
      });
    });

    it("blocks deactivation when department has active employees", async () => {
      // First call: fetch department
      // Second call: count active employees
      mock.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "dept-1", slug: "delivery", is_active: true },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                count: 5,
              }),
            }),
          }),
        });

      const result = await toggleDepartmentActive("dept-1");

      expect(result).toEqual({
        success: false,
        error: "Cannot deactivate: 5 active employees in this department. Reassign them first.",
      });
    });

    it("deactivates department with no active employees", async () => {
      mock.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "dept-1", slug: "finance", is_active: true },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                count: 0,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        });

      const result = await toggleDepartmentActive("dept-1");

      expect(result).toEqual({ success: true });

      // Verify the update called with is_active: false
      const updateCall = mock.from.mock.results[2].value.update;
      expect(updateCall).toHaveBeenCalledWith({ is_active: false });
    });

    it("reactivates inactive department without employee check", async () => {
      mock.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "dept-3", slug: "finance", is_active: false },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        });

      const result = await toggleDepartmentActive("dept-3");

      expect(result).toEqual({ success: true });

      // Verify update called with is_active: true
      const updateCall = mock.from.mock.results[1].value.update;
      expect(updateCall).toHaveBeenCalledWith({ is_active: true });

      // Should only have 2 from() calls (fetch + update), no employee count check
      expect(mock.from).toHaveBeenCalledTimes(2);
    });
  });
});
