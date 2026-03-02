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
  // ── 1. Define ALL mock functions first (no return values yet) ──

  // Query terminators
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });

  // Filter chain methods
  const mockEq = vi.fn();
  const mockNeq = vi.fn();
  const mockIs = vi.fn();
  const mockIn = vi.fn();
  const mockGt = vi.fn();
  const mockGte = vi.fn();
  const mockLt = vi.fn();
  const mockLte = vi.fn();

  // Primary operations
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();
  const mockInsert = vi.fn();
  const mockDelete = vi.fn();
  const mockUpsert = vi.fn();

  // ── 2. Build the shared chain object (all mocks are defined) ──

  const filterChain = () => ({
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

  // ── 3. Wire up return values ──

  // Filter methods return the full chain
  mockEq.mockReturnValue(filterChain());
  mockNeq.mockReturnValue(filterChain());
  mockIs.mockReturnValue(filterChain());
  mockIn.mockReturnValue(filterChain());
  mockGt.mockReturnValue(filterChain());
  mockGte.mockReturnValue(filterChain());
  mockLt.mockReturnValue(filterChain());
  mockLte.mockReturnValue(filterChain());

  // Primary operations return the full chain
  mockSelect.mockReturnValue(filterChain());
  mockUpdate.mockReturnValue(filterChain());
  mockInsert.mockReturnValue({ ...filterChain(), select: mockSelect });
  mockDelete.mockReturnValue(filterChain());
  mockUpsert.mockReturnValue({ ...filterChain(), select: mockSelect });

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
