import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * reconcileHubCourses reads the live Chat catalogue via listIntranetHubCourses
 * and mirrors it into native `courses` shells via the service client. Both are
 * mocked: the Chat query returns a fixture catalogue, and the service client's
 * `from("courses")` chain captures the load-existing select plus the insert /
 * update payloads so we can assert which upstream- vs admin-owned fields cross
 * the boundary.
 */

const mockListIntranetHubCourses = vi.hoisted(() => vi.fn());

const mockExistingEq = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockUpdateEq = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

const mockCreateServiceClient = vi.hoisted(() =>
  vi.fn(() => ({ from: mockFrom }))
);

vi.mock("@/lib/chat-content/queries", () => ({
  listIntranetHubCourses: mockListIntranetHubCourses,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mockCreateServiceClient,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { reconcileHubCourses } from "@/lib/chat-content/reconcile";

/**
 * Wire `from("courses")`:
 *  - .select("...").eq("source", "hub") → { data: existingRows } (mockExistingEq)
 *  - .update(payload).eq("id", x)       → mockUpdate (returns { eq: mockUpdateEq })
 *  - .insert(payload)                   → mockInsert
 */
function wireFrom() {
  mockUpdate.mockReturnValue({ eq: mockUpdateEq });
  mockFrom.mockImplementation((table: string) => {
    if (table !== "courses") throw new Error(`unexpected table: ${table}`);
    return {
      select: () => ({ eq: mockExistingEq }),
      update: mockUpdate,
      insert: mockInsert,
    };
  });
}

describe("reconcileHubCourses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateEq.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
    wireFrom();
  });

  it("inserts a shell carrying source='hub' and category='upskilling' for a Chat course with no existing shell", async () => {
    mockListIntranetHubCourses.mockResolvedValue([
      {
        id: "chat-1",
        title: "Safeguarding Basics",
        description: "Intro",
        estimated_duration_minutes: 30,
        target_audience: "staff",
        settings: {},
        published_at: "2026-01-01",
      },
    ]);
    // No existing shells.
    mockExistingEq.mockResolvedValue({ data: [], error: null });

    const result = await reconcileHubCourses();

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "hub",
        source_course_id: "chat-1",
        title: "Safeguarding Basics",
        description: "Intro",
        duration_minutes: 30,
        category: "upskilling",
        status: "published",
        is_active: true,
        is_required: false,
        issue_certificate: true,
      })
    );
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({
      inserted: 1,
      updated: 0,
      deactivated: 0,
      blockErrors: [],
    });
  });

  it("updates an existing shell with upstream fields only, not admin-owned ones", async () => {
    mockListIntranetHubCourses.mockResolvedValue([
      {
        id: "chat-1",
        title: "Safeguarding Basics v2",
        description: "Updated",
        estimated_duration_minutes: 45,
        target_audience: "staff",
        settings: {},
        published_at: "2026-01-01",
      },
    ]);
    mockExistingEq.mockResolvedValue({
      data: [{ id: "course-1", source_course_id: "chat-1", is_active: true }],
      error: null,
    });

    const result = await reconcileHubCourses();

    expect(mockUpdate).toHaveBeenCalledWith({
      title: "Safeguarding Basics v2",
      description: "Updated",
      duration_minutes: 45,
      is_active: true,
    });
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "course-1");
    // Admin-owned fields must never appear in the update payload.
    const updatePayload = mockUpdate.mock.calls[0][0];
    expect(updatePayload).not.toHaveProperty("category");
    expect(updatePayload).not.toHaveProperty("is_required");
    expect(updatePayload).not.toHaveProperty("issue_certificate");
    expect(updatePayload).not.toHaveProperty("status");
    expect(mockInsert).not.toHaveBeenCalled();
    expect(result).toEqual({
      inserted: 0,
      updated: 1,
      deactivated: 0,
      blockErrors: [],
    });
  });

  it("deactivates a shell whose source_course_id is absent from the live Chat set", async () => {
    // No live Chat courses this run.
    mockListIntranetHubCourses.mockResolvedValue([]);
    mockExistingEq.mockResolvedValue({
      data: [{ id: "course-9", source_course_id: "chat-gone", is_active: true }],
      error: null,
    });

    const result = await reconcileHubCourses();

    expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "course-9");
    expect(mockInsert).not.toHaveBeenCalled();
    expect(result).toEqual({
      inserted: 0,
      updated: 0,
      deactivated: 1,
      blockErrors: [],
    });
  });

  it("does not re-deactivate a shell that is already inactive", async () => {
    mockListIntranetHubCourses.mockResolvedValue([]);
    mockExistingEq.mockResolvedValue({
      data: [{ id: "course-9", source_course_id: "chat-gone", is_active: false }],
      error: null,
    });

    const result = await reconcileHubCourses();

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({
      inserted: 0,
      updated: 0,
      deactivated: 0,
      blockErrors: [],
    });
  });
});
