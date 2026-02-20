import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock strategy: Mock requireLDAdmin() from @/lib/auth instead of
 * the low-level Supabase client. This matches the CLAUDE.md pattern.
 *
 * exportReportCSV calls .from() multiple times with different tables,
 * so we use mockFrom.mockImplementation() with call-counting to wire
 * different chains for each sequential .from() call.
 */

const mockFrom = vi.hoisted(() => vi.fn());

const mockSupabase = vi.hoisted(() => ({
  from: mockFrom,
}));

vi.mock("@/lib/auth", () => ({
  requireLDAdmin: vi.fn().mockResolvedValue({
    supabase: mockSupabase,
    user: { id: "admin-1", email: "admin@mcrpathways.org" },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { exportReportCSV } from "@/app/(protected)/learning/admin/reports/actions";
import { requireLDAdmin } from "@/lib/auth";

// ---- Test data ----

const mockEnrolment = {
  id: "enr-1",
  status: "enrolled",
  progress_percent: 50,
  score: null,
  enrolled_at: "2026-03-15T10:00:00Z",
  completed_at: null,
  due_date: null,
  user_id: "u1",
  course_id: "c1",
};

const mockProfile = {
  id: "u1",
  full_name: "Alice Smith",
  email: "alice@mcrpathways.org",
  user_type: "staff",
  team_id: "t1",
};

const mockCourse = {
  id: "c1",
  title: "Intro Course",
  category: "onboarding",
};

const mockTeam = {
  id: "t1",
  name: "Team Alpha",
};

// ---- Helpers ----

/**
 * Create a thenable chainable mock that supports .select().eq().in()
 * and resolves when awaited.
 */
function createChainableMock<T>(resolveValue: T) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.then = (resolve: (val: T) => void) => resolve(resolveValue);
  return chain;
}

/**
 * Wire the standard mock chain for exportReportCSV with no profile pre-filter.
 * Call order: (1) course_enrolments, (2-4) Promise.all: profiles, courses, teams
 */
function wireDefaultMocks(overrides?: {
  enrolments?: typeof mockEnrolment[] | null;
  enrolError?: { message: string } | null;
  profiles?: typeof mockProfile[];
  courses?: typeof mockCourse[];
  teams?: typeof mockTeam[];
}) {
  const enrolments = overrides && "enrolments" in overrides ? overrides.enrolments : [mockEnrolment];
  const enrolError = overrides?.enrolError ?? null;
  const profiles = overrides?.profiles ?? [mockProfile];
  const courses = overrides?.courses ?? [mockCourse];
  const teams = overrides?.teams ?? [mockTeam];

  let callCount = 0;

  mockFrom.mockImplementation(() => {
    callCount++;

    if (callCount === 1) {
      // course_enrolments: .select().eq().in() → awaitable
      return createChainableMock({ data: enrolments, error: enrolError });
    }
    if (callCount === 2) {
      // profiles: .select().in() → promise
      return {
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({ data: profiles }),
        })),
      };
    }
    if (callCount === 3) {
      // courses: .select().in() → promise
      return {
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({ data: courses }),
        })),
      };
    }
    if (callCount === 4) {
      // teams: .select() → promise (no .in())
      return {
        select: vi.fn().mockResolvedValue({ data: teams }),
      };
    }

    return {};
  });
}

/**
 * Wire mocks when a profile pre-filter (teamId/userType) is active.
 * Call order: (1) profiles pre-query, (2) course_enrolments, (3-5) Promise.all
 */
function wireFilteredMocks(overrides?: {
  matchedProfileIds?: string[];
  enrolments?: typeof mockEnrolment[] | null;
  profiles?: typeof mockProfile[];
  courses?: typeof mockCourse[];
  teams?: typeof mockTeam[];
}) {
  const matchedProfileIds = overrides?.matchedProfileIds ?? ["u1"];
  const enrolments = overrides?.enrolments ?? [mockEnrolment];
  const profiles = overrides?.profiles ?? [mockProfile];
  const courses = overrides?.courses ?? [mockCourse];
  const teams = overrides?.teams ?? [mockTeam];

  let callCount = 0;

  mockFrom.mockImplementation(() => {
    callCount++;

    if (callCount === 1) {
      // Profile pre-query: .select("id").eq().eq() → thenable
      const profileData = matchedProfileIds.map((id) => ({ id }));
      return createChainableMock({ data: profileData });
    }
    if (callCount === 2) {
      // course_enrolments: .select().eq().in() → thenable
      return createChainableMock({ data: enrolments, error: null });
    }
    if (callCount === 3) {
      return {
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({ data: profiles }),
        })),
      };
    }
    if (callCount === 4) {
      return {
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({ data: courses }),
        })),
      };
    }
    if (callCount === 5) {
      return {
        select: vi.fn().mockResolvedValue({ data: teams }),
      };
    }

    return {};
  });
}

describe("exportReportCSV", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireLDAdmin).mockResolvedValue({
      supabase: mockSupabase as never,
      user: { id: "admin-1", email: "admin@mcrpathways.org" } as never,
    });
  });

  // ===========================================
  // Auth
  // ===========================================

  it("throws when user is not an L&D admin", async () => {
    vi.mocked(requireLDAdmin).mockRejectedValue(
      new Error("Unauthorised: L&D admin access required")
    );

    await expect(exportReportCSV({})).rejects.toThrow(
      "Unauthorised: L&D admin access required"
    );
  });

  // ===========================================
  // Success cases
  // ===========================================

  it("returns CSV with correct headers and data (no filters)", async () => {
    wireDefaultMocks();

    const result = await exportReportCSV({});

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.csv).toBeDefined();

    const lines = result.csv!.split("\n");
    expect(lines[0]).toBe(
      "User Name,Email,User Type,Team,Course,Category,Status,Progress %,Score,Enrolled At,Completed At,Due Date"
    );
    // Data row should contain the profile/course/team data
    expect(lines[1]).toContain("Alice Smith");
    expect(lines[1]).toContain("Intro Course");
    expect(lines[1]).toContain("Team Alpha");
  });

  it("returns CSV with formatted date (DD/MM/YYYY en-GB)", async () => {
    wireDefaultMocks({
      enrolments: [
        { ...mockEnrolment, enrolled_at: "2026-03-15T10:00:00Z" },
      ],
    });

    const result = await exportReportCSV({});

    expect(result.csv).toContain("15/03/2026");
  });

  it("handles null score, completed_at, and due_date gracefully", async () => {
    wireDefaultMocks({
      enrolments: [
        {
          ...mockEnrolment,
          score: null,
          completed_at: null,
          due_date: null,
        },
      ],
    });

    const result = await exportReportCSV({});

    expect(result.success).toBe(true);
    // The CSV cells for null values should be empty strings wrapped in quotes
    const dataRow = result.csv!.split("\n")[1];
    expect(dataRow).toContain('""');
  });

  it("escapes double quotes in CSV cell values", async () => {
    wireDefaultMocks({
      profiles: [{ ...mockProfile, full_name: 'Alice "Ally" Smith' }],
    });

    const result = await exportReportCSV({});

    // Double quotes should be escaped as ""
    expect(result.csv).toContain('Alice ""Ally"" Smith');
  });

  // ===========================================
  // Filters
  // ===========================================

  it("pre-queries profiles when teamId filter is set", async () => {
    wireFilteredMocks({ matchedProfileIds: ["u1"] });

    const result = await exportReportCSV({ teamId: "t1" });

    expect(result.success).toBe(true);
    // 1 pre-query + 1 enrolments + 3 Promise.all = 5 total
    expect(mockFrom).toHaveBeenCalledTimes(5);
  });

  it("pre-queries profiles when userType filter is set", async () => {
    wireFilteredMocks({ matchedProfileIds: ["u1"] });

    const result = await exportReportCSV({ userType: "staff" });

    expect(result.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(5);
  });

  it("returns 'No data to export' when profile filter matches no users", async () => {
    wireFilteredMocks({ matchedProfileIds: [] });

    const result = await exportReportCSV({ teamId: "nonexistent" });

    expect(result).toEqual({
      success: false,
      error: "No data to export",
      csv: null,
    });
    // Should not proceed to enrolment query
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  // ===========================================
  // Empty / error cases
  // ===========================================

  it("returns 'No data to export' when no enrolments found", async () => {
    wireDefaultMocks({ enrolments: [] });

    const result = await exportReportCSV({});

    expect(result).toEqual({
      success: false,
      error: "No data to export",
      csv: null,
    });
  });

  it("returns 'No data to export' when enrolments data is null", async () => {
    wireDefaultMocks({ enrolments: null });

    const result = await exportReportCSV({});

    expect(result).toEqual({
      success: false,
      error: "No data to export",
      csv: null,
    });
  });

  it("returns error on enrolment query DB failure", async () => {
    wireDefaultMocks({
      enrolError: { message: "Database connection error" },
    });

    const result = await exportReportCSV({});

    expect(result).toEqual({
      success: false,
      error: "Database connection error",
      csv: null,
    });
  });

  it("handles missing profile/course/team gracefully in CSV", async () => {
    wireDefaultMocks({
      enrolments: [
        { ...mockEnrolment, user_id: "unknown", course_id: "unknown" },
      ],
      profiles: [],
      courses: [],
      teams: [],
    });

    const result = await exportReportCSV({});

    expect(result.success).toBe(true);
    // The CSV should still have a data row with empty lookup values
    const dataRow = result.csv!.split("\n")[1];
    expect(dataRow).toBeDefined();
  });
});
