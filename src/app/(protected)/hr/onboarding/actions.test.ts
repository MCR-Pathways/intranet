import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Test strategy for onboarding actions:
 *
 * Mock `@/lib/auth` (requireHRAdmin / getCurrentUser) — same pattern as
 * flexible-working/actions.test.ts. Per-test chainable mocks.
 *
 * Actions grouped by role:
 *
 * TEMPLATE CRUD (HR admin only):
 *   createTemplate, updateTemplate, deleteTemplate
 *
 * TEMPLATE ITEM CRUD (HR admin only):
 *   addTemplateItem, updateTemplateItem, deleteTemplateItem, reorderTemplateItems
 *
 * TEMPLATE FETCH (HR admin only):
 *   fetchTemplates, fetchTemplateItems, fetchActiveTemplates
 *
 * CHECKLIST CRUD (HR admin only for create/complete/cancel):
 *   createOnboardingChecklist, completeOnboardingChecklist, cancelOnboardingChecklist
 *
 * ITEM MANAGEMENT (HR admin + line manager):
 *   toggleChecklistItem, addChecklistItem
 *
 * FETCH (various auth):
 *   fetchOnboardingDashboard, fetchChecklistDetail, fetchEmployeeOnboarding
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

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

// ── Import modules under test ──

import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  addTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
  reorderTemplateItems,
  fetchTemplates,
  fetchTemplateItems,
  fetchActiveTemplates,
  createOnboardingChecklist,
  completeOnboardingChecklist,
  cancelOnboardingChecklist,
  toggleChecklistItem,
  addChecklistItem,
  fetchOnboardingDashboard,
  fetchChecklistDetail,
  fetchEmployeeOnboarding,
} from "@/app/(protected)/hr/onboarding/actions";
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
  chain.order = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockImplementation(self);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.update = vi.fn().mockImplementation(self);
  chain.insert = vi.fn().mockImplementation(self);
  chain.delete = vi.fn().mockImplementation(self);
  chain.head = vi.fn().mockImplementation(self);
  return chain;
}

// ── Tests ──

describe("HR Onboarding Actions", () => {
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
  // TEMPLATE CRUD
  // =============================================

  describe("createTemplate", () => {
    it("requires HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValueOnce(new Error("Not authorised"));
      await expect(createTemplate({ name: "Test" })).rejects.toThrow();
    });

    it("requires template name", async () => {
      const result = await createTemplate({ name: "" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Template name is required");
    });

    it("rejects name that exceeds max length", async () => {
      const result = await createTemplate({ name: "x".repeat(256) });
      expect(result.success).toBe(false);
      expect(result.error).toContain("exceeds the maximum");
    });

    it("creates template successfully", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: { id: "tpl-1" }, error: null });
      mockFrom.mockReturnValue(c);

      const result = await createTemplate({ name: "New Starter", description: "Standard onboarding" });
      expect(result.success).toBe(true);
      expect(result.templateId).toBe("tpl-1");
    });

    it("returns error on DB failure", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: { message: "DB error" } });
      mockFrom.mockReturnValue(c);

      const result = await createTemplate({ name: "Test" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to create template");
    });
  });

  describe("updateTemplate", () => {
    it("requires HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValueOnce(new Error("Not authorised"));
      await expect(updateTemplate("tpl-1", { name: "Updated" })).rejects.toThrow();
    });

    it("rejects empty name", async () => {
      const result = await updateTemplate("tpl-1", { name: "" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Template name cannot be empty");
    });

    it("rejects when no valid fields to update", async () => {
      const result = await updateTemplate("tpl-1", {});
      expect(result.success).toBe(false);
      expect(result.error).toBe("No valid fields to update");
    });

    it("checks active checklists before deactivating", async () => {
      const c = chainable();
      // .select().eq("template_id").eq("status") — second .eq() is terminal
      c.eq
        .mockReturnValueOnce(c)
        .mockResolvedValueOnce({ count: 2, error: null });
      mockFrom.mockReturnValue(c);

      const result = await updateTemplate("tpl-1", { is_active: false });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot deactivate");
      expect(result.error).toContain("2 active onboarding checklists");
    });

    it("updates template successfully", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: { id: "tpl-1" }, error: null });
      mockFrom.mockReturnValue(c);

      const result = await updateTemplate("tpl-1", { name: "Updated Name" });
      expect(result.success).toBe(true);
    });
  });

  describe("deleteTemplate", () => {
    it("requires HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValueOnce(new Error("Not authorised"));
      await expect(deleteTemplate("tpl-1")).rejects.toThrow();
    });

    it("blocks deletion when active checklists exist", async () => {
      const c = chainable();
      // .select().eq("template_id").eq("status") — second .eq() is terminal
      c.eq
        .mockReturnValueOnce(c)
        .mockResolvedValueOnce({ count: 1, error: null });
      mockFrom.mockReturnValue(c);

      const result = await deleteTemplate("tpl-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot delete");
    });

    it("deletes template when no active checklists", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          // .select().eq().eq() — count query
          c.eq
            .mockReturnValueOnce(c)
            .mockResolvedValueOnce({ count: 0, error: null });
        } else if (callCount === 2) {
          // .delete().eq() — single .eq() is terminal
          c.eq.mockResolvedValue({ error: null });
        }
        return c;
      });

      const result = await deleteTemplate("tpl-1");
      expect(result.success).toBe(true);
    });
  });

  // =============================================
  // TEMPLATE ITEM CRUD
  // =============================================

  describe("addTemplateItem", () => {
    it("requires HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValueOnce(new Error("Not authorised"));
      await expect(addTemplateItem("tpl-1", { title: "Test" })).rejects.toThrow();
    });

    it("requires item title", async () => {
      const result = await addTemplateItem("tpl-1", { title: "" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Item title is required");
    });

    it("rejects invalid section", async () => {
      const result = await addTemplateItem("tpl-1", {
        title: "Test",
        section: "invalid" as never,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid section");
    });

    it("rejects invalid assignee role", async () => {
      const result = await addTemplateItem("tpl-1", {
        title: "Test",
        assignee_role: "ceo" as never,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid assignee role");
    });

    it("adds item with auto-incremented sort_order", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          // Existing items — find max sort_order
          c.limit.mockResolvedValue({
            data: [{ sort_order: 3 }],
            error: null,
          });
        } else if (callCount === 2) {
          // Insert new item
          c.single.mockResolvedValue({ data: { id: "item-1" }, error: null });
        }
        return c;
      });

      const result = await addTemplateItem("tpl-1", {
        title: "Set up email",
        section: "day_one",
        assignee_role: "hr_admin",
      });
      expect(result.success).toBe(true);
      expect(result.itemId).toBe("item-1");
    });
  });

  describe("updateTemplateItem", () => {
    it("rejects empty title", async () => {
      const result = await updateTemplateItem("item-1", { title: "" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Item title cannot be empty");
    });

    it("rejects invalid section", async () => {
      const result = await updateTemplateItem("item-1", {
        section: "bad_section" as never,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid section");
    });

    it("rejects when no valid fields provided", async () => {
      const result = await updateTemplateItem("item-1", {});
      expect(result.success).toBe(false);
      expect(result.error).toBe("No valid fields to update");
    });

    it("updates item successfully", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: { id: "item-1" }, error: null });
      mockFrom.mockReturnValue(c);

      const result = await updateTemplateItem("item-1", { title: "Updated title" });
      expect(result.success).toBe(true);
    });
  });

  describe("deleteTemplateItem", () => {
    it("deletes item successfully", async () => {
      const c = chainable();
      c.eq.mockResolvedValue({ error: null });
      mockFrom.mockReturnValue(c);

      const result = await deleteTemplateItem("item-1");
      expect(result.success).toBe(true);
    });

    it("returns error on DB failure", async () => {
      const c = chainable();
      c.eq.mockResolvedValue({ error: { message: "FK violation" } });
      mockFrom.mockReturnValue(c);

      const result = await deleteTemplateItem("item-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to delete item");
    });
  });

  describe("reorderTemplateItems", () => {
    it("reorders items by position", async () => {
      // Each item does .update().eq("id").eq("template_id")
      mockFrom.mockImplementation(() => {
        const c = chainable();
        c.eq
          .mockReturnValueOnce(c)
          .mockResolvedValueOnce({ error: null });
        return c;
      });

      const result = await reorderTemplateItems("tpl-1", ["item-3", "item-1", "item-2"]);
      expect(result.success).toBe(true);
    });

    it("returns error if any update fails", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 2) {
          c.eq
            .mockReturnValueOnce(c)
            .mockResolvedValueOnce({ error: { message: "update failed" } });
        } else {
          c.eq
            .mockReturnValueOnce(c)
            .mockResolvedValueOnce({ error: null });
        }
        return c;
      });

      const result = await reorderTemplateItems("tpl-1", ["item-1", "item-2"]);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to reorder");
    });
  });

  // =============================================
  // TEMPLATE FETCH
  // =============================================

  describe("fetchTemplates", () => {
    it("returns empty array when no templates", async () => {
      const c = chainable();
      c.order.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchTemplates();
      expect(result).toEqual([]);
    });

    it("returns templates with item counts", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          // Fetch templates
          c.order.mockResolvedValue({
            data: [
              { id: "tpl-1", name: "Standard", description: null, is_active: true, created_by: "admin-1", created_at: "2026-01-01" },
              { id: "tpl-2", name: "Intern", description: "For interns", is_active: false, created_by: "admin-1", created_at: "2026-02-01" },
            ],
            error: null,
          });
        } else if (callCount === 2) {
          // Fetch item counts
          c.in.mockResolvedValue({
            data: [
              { template_id: "tpl-1" },
              { template_id: "tpl-1" },
              { template_id: "tpl-1" },
              { template_id: "tpl-2" },
            ],
            error: null,
          });
        }
        return c;
      });

      const result = await fetchTemplates();
      expect(result).toHaveLength(2);
      expect(result[0].item_count).toBe(3);
      expect(result[1].item_count).toBe(1);
    });
  });

  describe("fetchTemplateItems", () => {
    it("returns empty array when no items", async () => {
      const c = chainable();
      // .select().eq().order("section").order("sort_order") — second .order() is terminal
      c.order
        .mockReturnValueOnce(c)
        .mockResolvedValueOnce({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchTemplateItems("tpl-1");
      expect(result).toEqual([]);
    });

    it("returns items sorted by section and sort_order", async () => {
      const c = chainable();
      c.order
        .mockReturnValueOnce(c)
        .mockResolvedValueOnce({
          data: [
            { id: "item-1", template_id: "tpl-1", title: "Welcome email", description: null, section: "before_start", assignee_role: "hr_admin", due_day_offset: -3, sort_order: 0 },
            { id: "item-2", template_id: "tpl-1", title: "Setup laptop", description: "With IT", section: "day_one", assignee_role: "other", due_day_offset: 0, sort_order: 0 },
          ],
          error: null,
        });
      mockFrom.mockReturnValue(c);

      const result = await fetchTemplateItems("tpl-1");
      expect(result).toHaveLength(2);
      expect(result[0].section).toBe("before_start");
      expect(result[1].section).toBe("day_one");
    });
  });

  describe("fetchActiveTemplates", () => {
    it("returns active templates with item counts", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.order.mockResolvedValue({
            data: [{ id: "tpl-1", name: "Standard", description: "Main template" }],
            error: null,
          });
        } else if (callCount === 2) {
          c.in.mockResolvedValue({
            data: [{ template_id: "tpl-1" }, { template_id: "tpl-1" }],
            error: null,
          });
        }
        return c;
      });

      const result = await fetchActiveTemplates();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Standard");
      expect(result[0].item_count).toBe(2);
    });
  });

  // =============================================
  // CHECKLIST CRUD
  // =============================================

  describe("createOnboardingChecklist", () => {
    const validData = {
      profile_id: "emp-1",
      template_id: "tpl-1",
      start_date: "2026-04-01",
      notes: "New starter",
    };

    it("requires HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValueOnce(new Error("Not authorised"));
      await expect(createOnboardingChecklist(validData)).rejects.toThrow();
    });

    it("requires all mandatory fields", async () => {
      const result = await createOnboardingChecklist({
        profile_id: "",
        template_id: "",
        start_date: "",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });

    it("rejects invalid start date", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        // Template items query (callCount 1)
        if (callCount === 1) {
          c.order.mockResolvedValue({
            data: [{ id: "item-1", title: "Task", description: null, section: "general", assignee_role: "hr_admin", due_day_offset: 0, sort_order: 0 }],
            error: null,
          });
        }
        return c;
      });

      const result = await createOnboardingChecklist({
        ...validData,
        start_date: "not-a-date",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid start date");
    });

    it("rejects template with no items", async () => {
      const c = chainable();
      // .select().eq().order("section").order("sort_order")
      c.order
        .mockReturnValueOnce(c)
        .mockResolvedValueOnce({ data: [], error: null });
      mockFrom.mockReturnValue(c);

      const result = await createOnboardingChecklist(validData);
      expect(result.success).toBe(false);
      expect(result.error).toContain("no items");
    });

    it("creates checklist with resolved due dates and assignees", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch template items: .select().eq().order("section").order("sort_order")
          c.order
            .mockReturnValueOnce(c)
            .mockResolvedValueOnce({
              data: [
                { id: "ti-1", title: "Welcome", description: null, section: "before_start", assignee_role: "hr_admin", due_day_offset: -3, sort_order: 0 },
                { id: "ti-2", title: "Meet team", description: "Intro", section: "day_one", assignee_role: "line_manager", due_day_offset: 0, sort_order: 1 },
                { id: "ti-3", title: "Read handbook", description: null, section: "first_week", assignee_role: "employee", due_day_offset: 5, sort_order: 2 },
              ],
              error: null,
            });
        } else if (callCount === 2) {
          // Fetch employee profile
          c.single.mockResolvedValue({
            data: { id: "emp-1", full_name: "New Starter", line_manager_id: "mgr-1" },
            error: null,
          });
        } else if (callCount === 3) {
          // Insert checklist
          c.single.mockResolvedValue({ data: { id: "cl-1" }, error: null });
        } else if (callCount === 4) {
          // Insert checklist items
          c.insert.mockResolvedValue({ error: null });
        }
        // Remaining calls are notifications — non-critical

        return c;
      });

      const result = await createOnboardingChecklist(validData);
      expect(result.success).toBe(true);
      expect(result.checklistId).toBe("cl-1");
    });

    it("returns error on unique constraint violation (active checklist exists)", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.order
            .mockReturnValueOnce(c)
            .mockResolvedValueOnce({
              data: [{ id: "ti-1", title: "Task", description: null, section: "general", assignee_role: "hr_admin", due_day_offset: 0, sort_order: 0 }],
              error: null,
            });
        } else if (callCount === 2) {
          c.single.mockResolvedValue({
            data: { id: "emp-1", full_name: "Existing", line_manager_id: null },
            error: null,
          });
        } else if (callCount === 3) {
          c.single.mockResolvedValue({
            data: null,
            error: { code: "23505", message: "unique violation" },
          });
        }

        return c;
      });

      const result = await createOnboardingChecklist(validData);
      expect(result.success).toBe(false);
      expect(result.error).toContain("already has an active onboarding checklist");
    });

    it("rolls back checklist on item insertion failure", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.order
            .mockReturnValueOnce(c)
            .mockResolvedValueOnce({
              data: [{ id: "ti-1", title: "Task", description: null, section: "general", assignee_role: "hr_admin", due_day_offset: 0, sort_order: 0 }],
              error: null,
            });
        } else if (callCount === 2) {
          c.single.mockResolvedValue({
            data: { id: "emp-1", full_name: "Test", line_manager_id: null },
            error: null,
          });
        } else if (callCount === 3) {
          c.single.mockResolvedValue({ data: { id: "cl-1" }, error: null });
        } else if (callCount === 4) {
          // Items insert fails
          c.insert.mockResolvedValue({ error: { message: "insert failed" } });
        }
        // Call 5 is rollback delete

        return c;
      });

      const result = await createOnboardingChecklist(validData);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to create checklist items");
    });
  });

  describe("completeOnboardingChecklist", () => {
    it("requires HR admin", async () => {
      vi.mocked(requireHRAdmin).mockRejectedValueOnce(new Error("Not authorised"));
      await expect(completeOnboardingChecklist("cl-1")).rejects.toThrow();
    });

    it("returns error when checklist not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await completeOnboardingChecklist("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Onboarding checklist not found");
    });

    it("returns error when checklist not active", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "cl-1", profile_id: "emp-1", status: "completed" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await completeOnboardingChecklist("cl-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("no longer active");
    });

    it("blocks completion when items are incomplete", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch checklist
          c.single.mockResolvedValue({
            data: { id: "cl-1", profile_id: "emp-1", status: "active" },
            error: null,
          });
        } else if (callCount === 2) {
          // .select("id", {count}).eq("checklist_id").eq("is_completed") — second .eq() is terminal
          c.eq
            .mockReturnValueOnce(c)
            .mockResolvedValueOnce({ count: 3, error: null });
        }

        return c;
      });

      const result = await completeOnboardingChecklist("cl-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("3 items still incomplete");
    });

    it("completes checklist when all items done", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { id: "cl-1", profile_id: "emp-1", status: "active" },
            error: null,
          });
        } else if (callCount === 2) {
          // Count incomplete — returns 0
          c.eq
            .mockReturnValueOnce(c)
            .mockResolvedValueOnce({ count: 0, error: null });
        } else if (callCount === 3) {
          // Update checklist status
          c.single.mockResolvedValue({ data: { id: "cl-1" }, error: null });
        }
        // Remaining calls are notifications

        return c;
      });

      const result = await completeOnboardingChecklist("cl-1");
      expect(result.success).toBe(true);
    });
  });

  describe("cancelOnboardingChecklist", () => {
    it("returns error when checklist not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await cancelOnboardingChecklist("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Onboarding checklist not found");
    });

    it("only cancels active checklists", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "cl-1", profile_id: "emp-1", status: "completed" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await cancelOnboardingChecklist("cl-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Only active checklists");
    });

    it("cancels checklist successfully", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { id: "cl-1", profile_id: "emp-1", status: "active" },
            error: null,
          });
        } else if (callCount === 2) {
          c.single.mockResolvedValue({ data: { id: "cl-1" }, error: null });
        }

        return c;
      });

      const result = await cancelOnboardingChecklist("cl-1");
      expect(result.success).toBe(true);
    });
  });

  // =============================================
  // ITEM MANAGEMENT
  // =============================================

  describe("toggleChecklistItem", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await toggleChecklistItem("item-1", true);
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when item not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await toggleChecklistItem("nonexistent", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Checklist item not found");
    });

    it("returns error when checklist not active", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch item
          c.single.mockResolvedValue({
            data: { id: "item-1", checklist_id: "cl-1" },
            error: null,
          });
        } else if (callCount === 2) {
          // Fetch checklist
          c.single.mockResolvedValue({
            data: { id: "cl-1", profile_id: "emp-1", status: "completed" },
            error: null,
          });
        }

        return c;
      });

      const result = await toggleChecklistItem("item-1", true);
      expect(result.success).toBe(false);
      expect(result.error).toContain("no longer active");
    });

    it("returns error when user is not authorised", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { id: "item-1", checklist_id: "cl-1" },
            error: null,
          });
        } else if (callCount === 2) {
          c.single.mockResolvedValue({
            data: { id: "cl-1", profile_id: "other-emp", status: "active" },
            error: null,
          });
        } else if (callCount === 3) {
          // verifyOnboardingAuthority: fetch profiles
          c.in.mockResolvedValue({
            data: [
              { id: "user-123", is_hr_admin: false, line_manager_id: null },
              { id: "other-emp", is_hr_admin: false, line_manager_id: "someone-else" },
            ],
            error: null,
          });
        }

        return c;
      });

      const result = await toggleChecklistItem("item-1", true);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not authorised");
    });

    it("toggles item when user is the employee", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          c.single.mockResolvedValue({
            data: { id: "item-1", checklist_id: "cl-1" },
            error: null,
          });
        } else if (callCount === 2) {
          // Checklist belongs to current user
          c.single.mockResolvedValue({
            data: { id: "cl-1", profile_id: "user-123", status: "active" },
            error: null,
          });
        } else if (callCount === 3) {
          // No authority DB call needed — employee = self
          // Update item
          c.single.mockResolvedValue({ data: { id: "item-1" }, error: null });
        }

        return c;
      });

      const result = await toggleChecklistItem("item-1", true);
      expect(result.success).toBe(true);
    });
  });

  describe("addChecklistItem", () => {
    it("requires item title", async () => {
      const result = await addChecklistItem("cl-1", { title: "" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Item title is required");
    });

    it("rejects adding to non-active checklist", async () => {
      const c = chainable();
      c.single.mockResolvedValue({
        data: { id: "cl-1", status: "completed" },
        error: null,
      });
      mockFrom.mockReturnValue(c);

      const result = await addChecklistItem("cl-1", { title: "New task" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("non-active checklist");
    });

    it("adds item to active checklist", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Verify checklist is active
          c.single.mockResolvedValue({
            data: { id: "cl-1", status: "active" },
            error: null,
          });
        } else if (callCount === 2) {
          // Get max sort_order
          c.limit.mockResolvedValue({
            data: [{ sort_order: 5 }],
            error: null,
          });
        } else if (callCount === 3) {
          // Insert item
          c.single.mockResolvedValue({ data: { id: "new-item-1" }, error: null });
        }

        return c;
      });

      const result = await addChecklistItem("cl-1", {
        title: "Additional task",
        section: "first_week",
        assignee_role: "line_manager",
      });
      expect(result.success).toBe(true);
      expect(result.itemId).toBe("new-item-1");
    });
  });

  // =============================================
  // FETCH ACTIONS
  // =============================================

  describe("fetchOnboardingDashboard", () => {
    it("returns empty array when no checklists", async () => {
      const c = chainable();
      c.order.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchOnboardingDashboard();
      expect(result).toEqual([]);
    });

    it("returns checklists with progress metrics", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch checklists with joins
          c.order.mockResolvedValue({
            data: [{
              id: "cl-1",
              profile_id: "emp-1",
              template_id: "tpl-1",
              initiated_by: "admin-123",
              status: "active",
              start_date: "2026-04-01",
              notes: null,
              completed_at: null,
              completed_by: null,
              created_at: "2026-03-01",
              profiles: { full_name: "New Starter", avatar_url: null, job_title: "Developer", department: "Engineering" },
              onboarding_templates: { name: "Standard" },
            }],
            error: null,
          });
        } else if (callCount === 2) {
          // Fetch all items for progress
          c.in.mockResolvedValue({
            data: [
              { checklist_id: "cl-1", is_completed: true, due_date: "2026-03-01" },
              { checklist_id: "cl-1", is_completed: false, due_date: "2026-02-01" }, // overdue
              { checklist_id: "cl-1", is_completed: false, due_date: "2027-01-01" },
            ],
            error: null,
          });
        }

        return c;
      });

      const result = await fetchOnboardingDashboard();
      expect(result).toHaveLength(1);
      expect(result[0].employee_name).toBe("New Starter");
      expect(result[0].total_items).toBe(3);
      expect(result[0].completed_items).toBe(1);
      expect(result[0].overdue_items).toBe(1);
      expect(result[0].template_name).toBe("Standard");
    });
  });

  describe("fetchChecklistDetail", () => {
    it("returns null when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await fetchChecklistDetail("cl-1");
      expect(result).toEqual({ checklist: null, items: [] });
    });

    it("returns null when checklist not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue(c);

      const result = await fetchChecklistDetail("nonexistent");
      expect(result).toEqual({ checklist: null, items: [] });
    });

    it("returns checklist detail with items and progress", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // Fetch checklist with joins
          c.single.mockResolvedValue({
            data: {
              id: "cl-1",
              profile_id: "user-123",
              template_id: "tpl-1",
              initiated_by: "admin-123",
              status: "active",
              start_date: "2026-04-01",
              notes: "Welcome aboard",
              completed_at: null,
              completed_by: null,
              created_at: "2026-03-01",
              profiles: { full_name: "Jane", avatar_url: null, job_title: null, department: null },
              onboarding_templates: { name: "Standard" },
            },
            error: null,
          });
        } else if (callCount === 2) {
          // Fetch items: .select().eq().order("section").order("sort_order")
          c.order
            .mockReturnValueOnce(c)
            .mockResolvedValueOnce({
              data: [
                { id: "item-1", checklist_id: "cl-1", title: "Task 1", description: null, section: "day_one", assignee_role: "hr_admin", assignee_id: "admin-123", due_date: "2026-04-01", sort_order: 0, is_completed: true, completed_at: "2026-04-01", completed_by: "admin-123" },
                { id: "item-2", checklist_id: "cl-1", title: "Task 2", description: "Details", section: "first_week", assignee_role: "employee", assignee_id: "user-123", due_date: "2026-04-05", sort_order: 1, is_completed: false, completed_at: null, completed_by: null },
              ],
              error: null,
            });
        }

        return c;
      });

      const result = await fetchChecklistDetail("cl-1");
      expect(result.checklist).not.toBeNull();
      expect(result.checklist!.employee_name).toBe("Jane");
      expect(result.checklist!.total_items).toBe(2);
      expect(result.checklist!.completed_items).toBe(1);
      expect(result.items).toHaveLength(2);
    });
  });

  describe("fetchEmployeeOnboarding", () => {
    it("returns empty when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await fetchEmployeeOnboarding("emp-1");
      expect(result).toEqual({ active: null, history: [] });
    });

    it("returns empty when no checklists exist", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // verifyOnboardingAuthority — user is HR admin
          c.in.mockResolvedValue({
            data: [
              { id: "user-123", is_hr_admin: true, line_manager_id: null },
            ],
            error: null,
          });
        } else if (callCount === 2) {
          // Fetch checklists
          c.order.mockResolvedValue({ data: [], error: null });
        }

        return c;
      });

      const result = await fetchEmployeeOnboarding("emp-1");
      expect(result).toEqual({ active: null, history: [] });
    });

    it("separates active from history checklists", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();

        if (callCount === 1) {
          // verifyOnboardingAuthority — HR admin
          c.in.mockResolvedValue({
            data: [{ id: "user-123", is_hr_admin: true, line_manager_id: null }],
            error: null,
          });
        } else if (callCount === 2) {
          // Fetch checklists
          c.order.mockResolvedValue({
            data: [
              { id: "cl-1", profile_id: "emp-1", template_id: "tpl-1", initiated_by: "admin-123", status: "active", start_date: "2026-04-01", notes: null, completed_at: null, completed_by: null, created_at: "2026-03-01", onboarding_templates: { name: "Standard" } },
              { id: "cl-2", profile_id: "emp-1", template_id: "tpl-1", initiated_by: "admin-123", status: "completed", start_date: "2025-01-01", notes: null, completed_at: "2025-03-01", completed_by: "admin-123", created_at: "2025-01-01", onboarding_templates: { name: "Standard" } },
            ],
            error: null,
          });
        } else if (callCount === 3) {
          // Fetch items for progress
          c.in.mockResolvedValue({
            data: [
              { checklist_id: "cl-1", is_completed: false, due_date: "2026-05-01" },
              { checklist_id: "cl-2", is_completed: true, due_date: "2025-02-01" },
            ],
            error: null,
          });
        } else if (callCount === 4) {
          // Fetch employee profile
          c.single.mockResolvedValue({
            data: { full_name: "Test Employee", avatar_url: null, job_title: "Dev", department: "Eng" },
            error: null,
          });
        }

        return c;
      });

      const result = await fetchEmployeeOnboarding("emp-1");
      expect(result.active).not.toBeNull();
      expect(result.active!.id).toBe("cl-1");
      expect(result.history).toHaveLength(1);
      expect(result.history[0].id).toBe("cl-2");
    });
  });
});
