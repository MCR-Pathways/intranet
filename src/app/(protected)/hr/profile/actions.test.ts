import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Test strategy for profile actions:
 *
 * All actions use getCurrentUser (self-service, not HR admin).
 * - updatePersonalDetails: whitelist blocks date_of_birth/ni_number, upserts employee_details
 * - upsertEmergencyContact: max 2 limit, ownership check on update
 * - deleteEmergencyContact: ownership check via double eq
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
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ── Import modules under test ──

import {
  updatePersonalDetails,
  upsertEmergencyContact,
  deleteEmergencyContact,
} from "@/app/(protected)/hr/profile/actions";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── Chainable mock helper ──

function chainable() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.eq = vi.fn().mockImplementation(self);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.update = vi.fn().mockImplementation(self);
  chain.insert = vi.fn().mockImplementation(self);
  chain.delete = vi.fn().mockImplementation(self);
  chain.upsert = vi.fn().mockResolvedValue({ error: null });
  return chain;
}

// ── Tests ──

describe("HR Profile Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getCurrentUser).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "user-123", email: "user@mcrpathways.org" } as never,
      profile: { id: "user-123", user_type: "staff" } as never,
    });
  });

  // =============================================
  // updatePersonalDetails
  // =============================================

  describe("updatePersonalDetails", () => {
    it("updates allowed personal details", async () => {
      const c = chainable();
      mockFrom.mockReturnValue(c);

      const result = await updatePersonalDetails({
        pronouns: "she/her",
        personal_email: "jane@example.com",
        city: "Glasgow",
      });

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith("employee_details");
      expect(revalidatePath).toHaveBeenCalledWith("/hr/profile");
    });

    it("strips disallowed fields (date_of_birth, ni_number)", async () => {
      const c = chainable();
      mockFrom.mockReturnValue(c);

      const result = await updatePersonalDetails({
        pronouns: "they/them",
        date_of_birth: "1990-01-01",
        ni_number: "AB123456C",
      } as Parameters<typeof updatePersonalDetails>[0]);

      expect(result.success).toBe(true);
      // Only pronouns should pass through
      expect(c.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ pronouns: "they/them", profile_id: "user-123" }),
        expect.anything(),
      );
      expect(c.upsert).toHaveBeenCalledWith(
        expect.not.objectContaining({ date_of_birth: "1990-01-01" }),
        expect.anything(),
      );
    });

    it("returns error when no valid fields provided", async () => {
      const result = await updatePersonalDetails({
        date_of_birth: "1990-01-01",
      } as Parameters<typeof updatePersonalDetails>[0]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No valid fields");
    });

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await updatePersonalDetails({ pronouns: "he/him" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Not authenticated");
    });

    it("returns error on DB failure", async () => {
      const c = chainable();
      c.upsert.mockResolvedValue({ error: { message: "Upsert failed" } });
      mockFrom.mockReturnValue(c);

      const result = await updatePersonalDetails({ city: "Edinburgh" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Upsert failed");
    });

    it("allows all expected fields", async () => {
      const c = chainable();
      mockFrom.mockReturnValue(c);

      const allFields = {
        pronouns: "he/him",
        personal_email: "test@example.com",
        personal_phone: "07700 900000",
        address_line_1: "1 Test Street",
        address_line_2: "Apt 2",
        city: "Glasgow",
        postcode: "G1 1AA",
        country: "United Kingdom",
        nationality: "British",
        gender: "male",
      };

      const result = await updatePersonalDetails(allFields);
      expect(result.success).toBe(true);
      expect(c.upsert).toHaveBeenCalledWith(
        expect.objectContaining(allFields),
        expect.anything(),
      );
    });
  });

  // =============================================
  // upsertEmergencyContact
  // =============================================

  describe("upsertEmergencyContact", () => {
    it("creates a new emergency contact", async () => {
      const c = chainable();
      // Count check: 0 existing contacts
      c.select.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
      });
      c.insert.mockResolvedValue({ error: null });
      mockFrom.mockReturnValue(c);

      const result = await upsertEmergencyContact({
        full_name: "Jane Doe",
        relationship: "Partner",
        phone_primary: "07700 900001",
        sort_order: 1,
      });

      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/hr/profile");
    });

    it("updates an existing emergency contact", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: { id: "contact-1" }, error: null });
      mockFrom.mockReturnValue(c);

      const result = await upsertEmergencyContact({
        id: "contact-1",
        full_name: "Jane Updated",
        relationship: "Spouse",
        phone_primary: "07700 900002",
        sort_order: 1,
      });

      expect(result.success).toBe(true);
    });

    it("returns error when max 2 contacts reached", async () => {
      const c = chainable();
      c.select.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
      });
      mockFrom.mockReturnValue(c);

      const result = await upsertEmergencyContact({
        full_name: "Third Contact",
        relationship: "Friend",
        phone_primary: "07700 900003",
        sort_order: 3,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Maximum of 2");
    });

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await upsertEmergencyContact({
        full_name: "Jane",
        relationship: "Partner",
        phone_primary: "07700 900001",
        sort_order: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Not authenticated");
    });

    it("returns error on insert DB failure", async () => {
      const c = chainable();
      c.select.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
      });
      c.insert.mockResolvedValue({ error: { message: "Insert failed" } });
      mockFrom.mockReturnValue(c);

      const result = await upsertEmergencyContact({
        full_name: "Jane",
        relationship: "Partner",
        phone_primary: "07700 900001",
        sort_order: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Insert failed");
    });

    it("returns error on update DB failure", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: { message: "Update failed" } });
      mockFrom.mockReturnValue(c);

      const result = await upsertEmergencyContact({
        id: "contact-1",
        full_name: "Jane",
        relationship: "Partner",
        phone_primary: "07700 900001",
        sort_order: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Update failed");
    });
  });

  // =============================================
  // deleteEmergencyContact
  // =============================================

  describe("deleteEmergencyContact", () => {
    it("deletes an emergency contact with ownership check", async () => {
      // .delete().eq("id", x).eq("profile_id", y) — double eq chain
      const mockSecondEq = vi.fn().mockResolvedValue({ error: null });
      const mockFirstEq = vi.fn().mockReturnValue({ eq: mockSecondEq });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockFirstEq });
      mockFrom.mockReturnValue({ delete: mockDelete });

      const result = await deleteEmergencyContact("contact-1");

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith("emergency_contacts");
      expect(mockFirstEq).toHaveBeenCalledWith("id", "contact-1");
      expect(mockSecondEq).toHaveBeenCalledWith("profile_id", "user-123");
      expect(revalidatePath).toHaveBeenCalledWith("/hr/profile");
    });

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const result = await deleteEmergencyContact("contact-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Not authenticated");
    });

    it("returns error on DB failure", async () => {
      const mockSecondEq = vi.fn().mockResolvedValue({ error: { message: "Delete failed" } });
      const mockFirstEq = vi.fn().mockReturnValue({ eq: mockSecondEq });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockFirstEq });
      mockFrom.mockReturnValue({ delete: mockDelete });

      const result = await deleteEmergencyContact("contact-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Delete failed");
    });
  });
});
