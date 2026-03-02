import { vi } from "vitest";

/**
 * Creates a mock Supabase client that mirrors the fluent API chains
 * used throughout this codebase.
 *
 * Common patterns mocked:
 *   supabase.from("table").select("...").eq("col", val).single()
 *   supabase.from("table").update({...}).eq("col", val)
 *   supabase.from("table").insert({...})
 *   supabase.from("table").insert({...}).select("...").single()
 *   supabase.from("table").delete().eq("col", val)
 *   supabase.from("table").upsert({...})
 *   supabase.from("table").select("...").eq().is().limit()
 *   supabase.from("table").select("...").in("col", [...])
 *   supabase.from("table").select("...").neq("col", val)
 *   supabase.storage.from("bucket").upload()
 *   supabase.storage.from("bucket").remove()
 *   supabase.storage.from("bucket").createSignedUrl()
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
 * introduces new Supabase query patterns.
 */
export function createMockSupabaseClient() {
  // Query terminators
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });

  // Chain methods — all return an object with further chain methods
  const chainable = () => ({
    single: mockSingle,
    order: mockOrder,
    limit: mockLimit,
    eq: mockEq,
    neq: mockNeq,
    is: mockIs,
    in: mockIn,
    gt: mockGt,
    gte: mockGte,
    lt: mockLt,
    lte: mockLte,
  });

  const mockEq = vi.fn().mockReturnValue({ ...chainable(), eq: undefined as never });
  // Re-assign eq in chainable after mockEq is defined
  const fullChain = () => ({
    single: mockSingle,
    order: mockOrder,
    limit: mockLimit,
    eq: mockEq,
    neq: mockNeq,
    is: mockIs,
    in: mockIn,
    gt: mockGt,
    gte: mockGte,
    lt: mockLt,
    lte: mockLte,
    select: mockSelect,
  });

  mockEq.mockReturnValue(fullChain());

  const mockNeq = vi.fn().mockReturnValue(fullChain());
  const mockIs = vi.fn().mockReturnValue(fullChain());
  const mockIn = vi.fn().mockReturnValue(fullChain());
  const mockGt = vi.fn().mockReturnValue(fullChain());
  const mockGte = vi.fn().mockReturnValue(fullChain());
  const mockLt = vi.fn().mockReturnValue(fullChain());
  const mockLte = vi.fn().mockReturnValue(fullChain());

  // Primary operations
  const mockSelect = vi.fn().mockReturnValue(fullChain());
  const mockUpdate = vi.fn().mockReturnValue(fullChain());
  const mockInsert = vi.fn().mockReturnValue({ ...fullChain(), select: mockSelect });
  const mockDelete = vi.fn().mockReturnValue(fullChain());
  const mockUpsert = vi.fn().mockReturnValue({ ...fullChain(), select: mockSelect });

  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
    delete: mockDelete,
    upsert: mockUpsert,
  });

  // RPC
  const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });

  // Auth
  const mockGetUser = vi.fn().mockResolvedValue({
    data: { user: null },
    error: null,
  });

  const mockRefreshSession = vi.fn().mockResolvedValue({
    data: { session: null },
    error: null,
  });

  // Storage
  const mockStorageUpload = vi.fn().mockResolvedValue({ data: { path: "test.pdf" }, error: null });
  const mockStorageRemove = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockStorageCreateSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://example.com/signed-url" },
    error: null,
  });

  const mockStorageFrom = vi.fn().mockReturnValue({
    upload: mockStorageUpload,
    remove: mockStorageRemove,
    createSignedUrl: mockStorageCreateSignedUrl,
  });

  return {
    from: mockFrom,
    rpc: mockRpc,
    auth: {
      getUser: mockGetUser,
      signOut: vi.fn().mockResolvedValue({ error: null }),
      refreshSession: mockRefreshSession,
    },
    storage: {
      from: mockStorageFrom,
    },
    _mocks: {
      // Primary operations
      mockFrom,
      mockSelect,
      mockUpdate,
      mockInsert,
      mockDelete,
      mockUpsert,
      mockRpc,
      // Chain methods
      mockEq,
      mockNeq,
      mockIs,
      mockIn,
      mockGt,
      mockGte,
      mockLt,
      mockLte,
      // Terminators
      mockSingle,
      mockOrder,
      mockLimit,
      // Auth
      mockGetUser,
      mockRefreshSession,
      // Storage
      mockStorageFrom,
      mockStorageUpload,
      mockStorageRemove,
      mockStorageCreateSignedUrl,
    },
  };
}
