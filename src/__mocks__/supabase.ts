import { vi } from "vitest";

/**
 * Creates a mock Supabase client that mirrors the fluent API chains
 * used throughout this codebase.
 *
 * Common patterns mocked:
 *   supabase.from("table").select("...").eq("col", val).single()
 *   supabase.from("table").update({...}).eq("col", val)
 *   supabase.from("table").insert({...})
 *   supabase.auth.getUser()
 *
 * IMPORTANT — Mocking strategy for this project:
 *
 * For SERVER ACTIONS (actions.ts files):
 *   Mock `@/lib/auth` (requireHRAdmin / getCurrentUser) instead of
 *   the low-level Supabase client. This avoids the fluent chain
 *   complexity where `mockEq` is shared between select and update chains.
 *   See `actions.test.ts` for the pattern.
 *
 * For MIDDLEWARE (middleware.ts):
 *   Mock `@/lib/supabase/middleware` (updateSession) to control auth state,
 *   then mock the simple `.from().select().eq().single()` chain for profile
 *   fetching. See `middleware.test.ts` for the pattern.
 *
 * This factory is useful for cases where you need a full mock Supabase
 * client (e.g., testing `getCurrentUser` or `requireHRAdmin` themselves).
 *
 * Usage:
 *   const mockClient = createMockSupabaseClient();
 *   // Configure return values:
 *   mockClient._mocks.mockSingle.mockResolvedValue({ data: {...}, error: null });
 *   // Assert calls:
 *   expect(mockClient.from).toHaveBeenCalledWith("profiles");
 *
 * To extend: add new chain methods as needed when the codebase
 * introduces new Supabase query patterns (e.g., .in(), .not(), .range()).
 */
export function createMockSupabaseClient() {
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockEq = vi.fn().mockReturnValue({ single: mockSingle, order: mockOrder });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq, order: mockOrder });

  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  });

  const mockGetUser = vi.fn().mockResolvedValue({
    data: { user: null },
    error: null,
  });

  return {
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    _mocks: {
      mockFrom,
      mockSelect,
      mockUpdate,
      mockInsert,
      mockEq,
      mockSingle,
      mockOrder,
      mockGetUser,
    },
  };
}
