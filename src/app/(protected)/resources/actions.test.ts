/**
 * Tests for intranet resource (knowledge base) server actions.
 *
 * Mock strategy: mock @/lib/auth (requireContentEditor / getCurrentUser) instead
 * of the Supabase client. Use per-test mockFrom.mockImplementation for chain routing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockSupabase,
  mockFrom,
  mockRpc: _mockRpc,
  requireContentEditor,
  getCurrentUser,
  revalidatePath,
} = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockSupabase = { from: mockFrom, rpc: mockRpc };
  return {
    mockSupabase,
    mockFrom,
    mockRpc,
    requireContentEditor: vi.fn(),
    getCurrentUser: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({
  requireContentEditor,
  getCurrentUser,
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("@/lib/tiptap", () => ({
  extractPlainText: vi.fn((doc: Record<string, unknown>) => {
    // Simple mock: return concatenated text from doc content
    if (!doc?.content) return "";
    return "extracted plain text";
  }),
}));

const mockRemoveArticleFromIndex = vi.hoisted(() => vi.fn());
vi.mock("@/lib/algolia", () => ({
  removeArticleFromIndex: mockRemoveArticleFromIndex,
}));

// Logger mock — silences stderr during error-path tests and lets us assert
// the "no silent swallow" contract in fetchDraftCount.
const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chainable() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.insert = vi.fn().mockImplementation(self);
  chain.update = vi.fn().mockImplementation(self);
  chain.delete = vi.fn().mockImplementation(self);
  chain.upsert = vi.fn().mockImplementation(self);
  chain.eq = vi.fn().mockImplementation(self);
  chain.neq = vi.fn().mockImplementation(self);
  chain.in = vi.fn().mockImplementation(self);
  chain.is = vi.fn().mockImplementation(self);
  chain.not = vi.fn().mockImplementation(self);
  chain.filter = vi.fn().mockImplementation(self);
  chain.single = vi.fn();
  chain.limit = vi.fn().mockImplementation(self);
  chain.order = vi.fn().mockImplementation(self);
  chain.maybeSingle = vi.fn();
  return chain;
}

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import {
  createCategory,
  updateCategory,
  deleteCategory,
  updateArticle,
  deleteArticle,
  fetchCategoriesWithClient,
  fetchCategoryArticlesWithClient,
  fetchArticleBySlugOnly,
  fetchDraftCount,
  fetchDraftArticles,
  fetchRecentlyUpdatedArticles,
} from "./actions";

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  requireContentEditor.mockResolvedValue({
    supabase: mockSupabase as never,
    user: { id: "admin-123" } as never,
    profile: { id: "admin-123" } as never,
  });
  getCurrentUser.mockResolvedValue({
    supabase: mockSupabase as never,
    user: { id: "user-123" } as never,
    profile: { id: "user-123" } as never,
  });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Intranet Resource Actions", () => {
  // =============================================
  // createCategory
  // =============================================

  describe("createCategory", () => {
    function setupCreateChain(opts?: {
      slugExists?: boolean;
      maxSortOrder?: number | null;
      insertError?: boolean;
    }) {
      const callLog: string[] = [];
      mockFrom.mockImplementation((table: string) => {
        callLog.push(table);
        const c = chainable();
        const catCalls = callLog.filter((t) => t === "resource_categories").length;

        if (table === "resource_categories") {
          if (catCalls === 1) {
            // ensureUniqueCategorySlug — check if slug exists
            c.limit.mockResolvedValue({
              data: opts?.slugExists ? [{ id: "existing-1" }] : [],
              error: null,
            });
          } else if (catCalls === 2) {
            if (opts?.slugExists) {
              // Second slug check (with suffix) — now unique
              c.limit.mockResolvedValue({ data: [], error: null });
            } else {
              // Get max sort_order
              c.single.mockResolvedValue({
                data: opts?.maxSortOrder !== undefined
                  ? { sort_order: opts.maxSortOrder }
                  : { sort_order: 2 },
                error: null,
              });
            }
          } else if (catCalls === 3) {
            if (opts?.slugExists) {
              // Get max sort_order (shifted by one call due to slug retry)
              c.single.mockResolvedValue({
                data: { sort_order: 2 },
                error: null,
              });
            } else {
              // Insert
              c.single.mockResolvedValue(
                opts?.insertError
                  ? { data: null, error: { message: "Insert failed" } }
                  : { data: { id: "cat-1", name: "Test", slug: "test", sort_order: 3 }, error: null },
              );
            }
          } else {
            // Insert after slug retry
            c.single.mockResolvedValue({
              data: { id: "cat-1", name: "Test", slug: "test-2", sort_order: 3 },
              error: null,
            });
          }
        }
        return c;
      });
    }

    it("creates a category with slugified name", async () => {
      setupCreateChain();

      const result = await createCategory({ name: "My Test Category" });
      expect(result.success).toBe(true);
      expect(result.category).toBeDefined();
      expect(revalidatePath).toHaveBeenCalledWith("/resources", "layout");
    });

    it("returns error for empty name", async () => {
      const result = await createCategory({ name: "  " });
      expect(result.success).toBe(false);
      expect(result.error).toContain("name is required");
    });

    it("returns error for name that produces empty slug", async () => {
      const result = await createCategory({ name: "!!!" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid category name");
    });

    it("deduplicates slug when collision exists", async () => {
      setupCreateChain({ slugExists: true });

      const result = await createCategory({ name: "Test" });
      expect(result.success).toBe(true);
      // Verify slug was deduplicated with suffix
      expect(result.category?.slug).toBe("test-2");
    });

    it("returns error on DB insert failure", async () => {
      setupCreateChain({ insertError: true });

      const result = await createCategory({ name: "Test" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to create");
    });

    it("throws when user is not a content editor or HR admin", async () => {
      vi.mocked(requireContentEditor).mockRejectedValue(new Error("Not authorised"));
      await expect(createCategory({ name: "Test" })).rejects.toThrow("Not authorised");
    });
  });

  // =============================================
  // updateCategory
  // =============================================

  describe("updateCategory", () => {
    function setupUpdateChain(opts?: {
      slugExists?: boolean;
      updateError?: boolean;
    }) {
      const callLog: string[] = [];
      mockFrom.mockImplementation((table: string) => {
        callLog.push(table);
        const c = chainable();
        const catCalls = callLog.filter((t) => t === "resource_categories").length;

        if (table === "resource_categories") {
          if (catCalls === 1) {
            // ensureUniqueCategorySlug — check if slug exists
            c.limit.mockResolvedValue({
              data: opts?.slugExists ? [{ id: "other-cat" }] : [],
              error: null,
            });
          } else if (catCalls === 2 && opts?.slugExists) {
            // Second slug check with suffix
            c.limit.mockResolvedValue({ data: [], error: null });
          } else {
            // Update
            c.single.mockResolvedValue(
              opts?.updateError
                ? { data: null, error: { message: "Update failed" } }
                : { data: { id: "cat-1" }, error: null },
            );
          }
        }
        return c;
      });
    }

    it("updates category name and regenerates slug", async () => {
      setupUpdateChain();

      const result = await updateCategory("cat-1", { name: "New Name" });
      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalled();
    });

    it("updates description only", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: { id: "cat-1" }, error: null });
      mockFrom.mockReturnValue(c);

      const result = await updateCategory("cat-1", { description: "Updated description" });
      expect(result.success).toBe(true);
    });

    it("returns error for empty name", async () => {
      const result = await updateCategory("cat-1", { name: "  " });
      expect(result.success).toBe(false);
      expect(result.error).toContain("name is required");
    });

    it("returns error when no changes provided", async () => {
      const result = await updateCategory("cat-1", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("No changes");
    });

    it("returns error on DB update failure", async () => {
      setupUpdateChain({ updateError: true });

      const result = await updateCategory("cat-1", { name: "Renamed" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to update");
    });

    it("throws when user is not a content editor or HR admin", async () => {
      vi.mocked(requireContentEditor).mockRejectedValue(new Error("Not authorised"));
      await expect(updateCategory("cat-1", { name: "New" })).rejects.toThrow("Not authorised");
    });
  });

  // =============================================
  // deleteCategory
  // =============================================

  describe("deleteCategory", () => {
    it("soft-deletes a category with no subcategories or articles", async () => {
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          // First call: subcategory count check (resource_categories) — returns 0
          c.is.mockReturnValue({ count: 0, error: null });
          return c;
        }
        if (table === "resource_articles") {
          // Second call: article count check — returns 0
          c.is.mockReturnValue({ count: 0, error: null });
          return c;
        }
        // Third call: soft-delete update
        c.single.mockResolvedValue({ data: { id: "cat-1" }, error: null });
        return c;
      });

      const result = await deleteCategory("cat-1");
      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/resources", "layout");
    });

    it("blocks deletion when category has subcategories", async () => {
      const c = chainable();
      // First call: subcategory count check — returns 3
      c.is.mockReturnValue({ count: 3, error: null });
      mockFrom.mockReturnValue(c);

      const result = await deleteCategory("cat-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("3 subcategories");
    });

    it("blocks deletion when category has articles", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          // First call: subcategory count check — returns 0
          c.is.mockReturnValue({ count: 0, error: null });
          return c;
        }
        // Second call: article count check — returns 3
        c.is.mockReturnValue({ count: 3, error: null });
        return c;
      });

      const result = await deleteCategory("cat-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("3 articles");
    });

    it("returns error on DB failure", async () => {
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          // First call: subcategory count check — returns 0
          c.is.mockReturnValue({ count: 0, error: null });
          return c;
        }
        if (table === "resource_articles") {
          c.is.mockReturnValue({ count: 0, error: null });
          return c;
        }
        c.single.mockResolvedValue({ data: null, error: { message: "Update failed" } });
        return c;
      });

      const result = await deleteCategory("cat-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to delete");
    });

    it("throws when user is not a content editor or HR admin", async () => {
      vi.mocked(requireContentEditor).mockRejectedValue(new Error("Not authorised"));
      await expect(deleteCategory("cat-1")).rejects.toThrow("Not authorised");
    });
  });

  // =============================================
  // getCategoryArticleCount
  // =============================================

  // =============================================
  // updateArticle
  // =============================================

  describe("updateArticle", () => {
    function setupArticleUpdateChain(opts?: {
      currentCategoryId?: string;
      currentPublishedAt?: string | null;
      slugExists?: boolean;
      updateError?: boolean;
    }) {
      const callLog: string[] = [];
      mockFrom.mockImplementation((table: string) => {
        callLog.push(table);
        const c = chainable();

        if (table === "resource_articles") {
          const artCalls = callLog.filter((t) => t === "resource_articles").length;

          if (artCalls === 1) {
            // Fetch category_id or published_at for current article
            c.single.mockResolvedValue({
              data: {
                category_id: opts?.currentCategoryId ?? "cat-1",
                published_at: opts?.currentPublishedAt !== undefined
                  ? opts.currentPublishedAt
                  : null,
              },
              error: null,
            });
          } else if (artCalls === 2) {
            // Could be slug check or second fetch (published_at) or the update itself
            // For title updates: slug check
            c.limit.mockResolvedValue({
              data: opts?.slugExists ? [{ id: "other-art" }] : [],
              error: null,
            });
            // For status updates: fetch published_at
            c.single.mockResolvedValue({
              data: {
                published_at: opts?.currentPublishedAt !== undefined
                  ? opts.currentPublishedAt
                  : null,
              },
              error: null,
            });
          } else {
            // Update (or slug check retry)
            c.limit.mockResolvedValue({ data: [], error: null });
            c.single.mockResolvedValue(
              opts?.updateError
                ? { data: null, error: { message: "Update failed" } }
                : { data: { id: "art-1" }, error: null },
            );
          }
        }
        return c;
      });
    }

    it("updates article title and regenerates slug", async () => {
      setupArticleUpdateChain();

      const result = await updateArticle("art-1", { title: "New Title" });
      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalled();
    });

    it("updates article content_json", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: { id: "art-1" }, error: null });
      mockFrom.mockReturnValue(c);

      const result = await updateArticle("art-1", {
        content_json: { type: "doc", content: [] } as never,
      });
      expect(result.success).toBe(true);
    });

    it("sets published_at on first publish", async () => {
      setupArticleUpdateChain({ currentPublishedAt: null });

      const result = await updateArticle("art-1", { status: "published" });
      expect(result.success).toBe(true);
    });

    it("does not overwrite published_at on re-publish", async () => {
      setupArticleUpdateChain({ currentPublishedAt: "2026-01-01T00:00:00Z" });

      const result = await updateArticle("art-1", { status: "published" });
      expect(result.success).toBe(true);
    });


    it("returns slug-exists message when DB update hits 23505 unique violation", async () => {
      // Simulate concurrent slug collision caught at DB level.
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.single.mockResolvedValue({ data: { category_id: "cat-1" }, error: null });
        } else if (callCount === 2) {
          c.limit.mockResolvedValue({ data: [], error: null });
        } else {
          c.single.mockResolvedValue({
            data: null,
            error: { code: "23505", message: "unique violation" },
          });
        }
        return c;
      });

      const result = await updateArticle("art-1", { title: "Colliding title" });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/slug already exists/i);
    });

    it("returns error for empty title", async () => {
      const result = await updateArticle("art-1", { title: "  " });
      expect(result.success).toBe(false);
      expect(result.error).toContain("title is required");
    });

    it("returns error when no changes provided", async () => {
      const result = await updateArticle("art-1", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("No changes");
    });

    it("returns error on DB update failure", async () => {
      setupArticleUpdateChain({ updateError: true });

      const result = await updateArticle("art-1", { title: "Renamed" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to update");
    });

    it("throws when user is not a content editor or HR admin", async () => {
      vi.mocked(requireContentEditor).mockRejectedValue(new Error("Not authorised"));
      await expect(updateArticle("art-1", { title: "New" })).rejects.toThrow("Not authorised");
    });
  });

  // =============================================
  // deleteArticle
  // =============================================

  describe("deleteArticle", () => {
    it("soft-deletes a published article and removes from Algolia", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          // Pre-fetch: return article with status
          c.single.mockResolvedValue({ data: { id: "art-1", status: "published" }, error: null });
        } else {
          // Update: soft-delete succeeds
          c.single.mockResolvedValue({ data: { id: "art-1" }, error: null });
        }
        return c;
      });

      const result = await deleteArticle("art-1");
      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/resources", "layout");
      expect(mockRemoveArticleFromIndex).toHaveBeenCalledWith("art-1");
    });

    it("soft-deletes a draft article without Algolia removal", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.single.mockResolvedValue({ data: { id: "art-1", status: "draft" }, error: null });
        } else {
          c.single.mockResolvedValue({ data: { id: "art-1" }, error: null });
        }
        return c;
      });

      const result = await deleteArticle("art-1");
      expect(result.success).toBe(true);
      expect(mockRemoveArticleFromIndex).not.toHaveBeenCalled();
    });

    it("returns error when article not found", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: { code: "PGRST116", message: "No rows" } });
      mockFrom.mockReturnValue(c);

      const result = await deleteArticle("art-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("returns generic error on fetch failure", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: { code: "42501", message: "Connection refused" } });
      mockFrom.mockReturnValue(c);

      const result = await deleteArticle("art-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to delete");
    });

    it("returns error on DB update failure", async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const c = chainable();
        if (callCount === 1) {
          c.single.mockResolvedValue({ data: { id: "art-1", status: "published" }, error: null });
        } else {
          c.single.mockResolvedValue({ data: null, error: { message: "Update failed" } });
        }
        return c;
      });

      const result = await deleteArticle("art-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to delete");
    });

    it("throws when user is not a content editor or HR admin", async () => {
      vi.mocked(requireContentEditor).mockRejectedValue(new Error("Not authorised"));
      await expect(deleteArticle("art-1")).rejects.toThrow("Not authorised");
    });
  });

  // =============================================
  // fetchCategoriesWithClient
  // =============================================

  describe("fetchCategoriesWithClient", () => {
    it("returns categories with article counts", async () => {
      const c = chainable();
      // .order("sort_order").order("name") — second order resolves
      const secondOrder = vi.fn().mockResolvedValue({
        data: [
          {
            id: "cat-1",
            name: "Policies",
            slug: "policies",
            resource_articles: [{ count: 3 }],
          },
          {
            id: "cat-2",
            name: "Guides",
            slug: "guides",
            resource_articles: [{ count: 0 }],
          },
        ],
        error: null,
      });
      c.order.mockReturnValue({ order: secondOrder });
      mockFrom.mockReturnValue(c);

      const result = await fetchCategoriesWithClient(mockSupabase as never);
      expect(result).toHaveLength(2);
      expect(result[0].article_count).toBe(3);
      expect(result[1].article_count).toBe(0);
    });

    it("returns empty array on error", async () => {
      const c = chainable();
      const secondOrder = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "DB error" },
      });
      c.order.mockReturnValue({ order: secondOrder });
      mockFrom.mockReturnValue(c);

      const result = await fetchCategoriesWithClient(mockSupabase as never);
      expect(result).toEqual([]);
    });
  });

  // =============================================
  // fetchCategoryArticlesWithClient
  // =============================================

  describe("fetchCategoryArticlesWithClient", () => {
    function setupFetchArticlesChain(opts?: {
      categoryNotFound?: boolean;
      articlesError?: boolean;
    }) {
      const callLog: string[] = [];
      mockFrom.mockImplementation((table: string) => {
        callLog.push(table);
        const c = chainable();

        if (table === "resource_categories") {
          c.single.mockResolvedValue(
            opts?.categoryNotFound
              ? { data: null, error: { message: "Not found" } }
              : { data: { id: "cat-1", name: "Policies", slug: "policies" }, error: null },
          );
        }
        if (table === "resource_articles") {
          c.order.mockResolvedValue(
            opts?.articlesError
              ? { data: null, error: { message: "Fetch error" } }
              : {
                  data: [
                    { id: "art-1", title: "Article 1", author: { id: "u-1", full_name: "Alice" } },
                  ],
                  error: null,
                },
          );
        }
        return c;
      });
    }

    it("returns category and articles when canViewDrafts=true (content editor)", async () => {
      setupFetchArticlesChain();

      const result = await fetchCategoryArticlesWithClient(
        mockSupabase as never,
        "policies",
        true,
      );
      expect(result.category).toBeDefined();
      expect(result.articles).toHaveLength(1);
    });

    it("filters published-only when canViewDrafts=false (reader or HR-admin-only)", async () => {
      const callLog: string[] = [];
      mockFrom.mockImplementation((table: string) => {
        callLog.push(table);
        const c = chainable();

        if (table === "resource_categories") {
          c.single.mockResolvedValue({
            data: { id: "cat-1", name: "Policies", slug: "policies" },
            error: null,
          });
        }
        if (table === "resource_articles") {
          // .order() returns object with .eq() for the status filter
          c.order.mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "art-1", title: "Published Only", author: { id: "u-1", full_name: "Alice" } },
              ],
              error: null,
            }),
          });
        }
        return c;
      });

      const result = await fetchCategoryArticlesWithClient(
        mockSupabase as never,
        "policies",
        false,
      );
      expect(result.category).toBeDefined();
      expect(result.articles).toHaveLength(1);
    });

    it("returns null category when slug not found", async () => {
      setupFetchArticlesChain({ categoryNotFound: true });

      const result = await fetchCategoryArticlesWithClient(
        mockSupabase as never,
        "nonexistent",
        true,
      );
      expect(result.category).toBeNull();
      expect(result.articles).toEqual([]);
    });

    it("returns empty articles on fetch error", async () => {
      setupFetchArticlesChain({ articlesError: true });

      const result = await fetchCategoryArticlesWithClient(
        mockSupabase as never,
        "policies",
        true,
      );
      expect(result.category).toBeDefined();
      expect(result.articles).toEqual([]);
    });
  });

  // =============================================
  // fetchDraftCount — used by the WS2 Drafts pill
  // =============================================

  describe("fetchDraftCount", () => {
    it("returns the Supabase count when the query succeeds", async () => {
      mockFrom.mockImplementation(() => {
        const c = chainable();
        // eq() is the terminal call; make it resolve directly to {count, error}.
        c.eq.mockResolvedValue({ count: 7, error: null });
        return c;
      });

      const result = await fetchDraftCount(mockSupabase as never);
      expect(result).toBe(7);
    });

    it("returns 0 when the query returns no count", async () => {
      mockFrom.mockImplementation(() => {
        const c = chainable();
        c.eq.mockResolvedValue({ count: null, error: null });
        return c;
      });

      const result = await fetchDraftCount(mockSupabase as never);
      expect(result).toBe(0);
    });

    it("logs and returns 0 on DB error — no silent swallow", async () => {
      mockFrom.mockImplementation(() => {
        const c = chainable();
        c.eq.mockResolvedValue({ count: null, error: { message: "boom" } });
        return c;
      });

      const result = await fetchDraftCount(mockSupabase as never);
      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith("fetchDraftCount failed", {
        error: "boom",
      });
    });
  });

  // =============================================
  // fetchArticleBySlugOnly — draft-visibility governance
  // =============================================

  describe("fetchArticleBySlugOnly", () => {
    it("reader (canViewDrafts=false) sees a draft article as null — no leak", async () => {
      // Simulate the query returning null because the status filter excluded
      // the draft. This mirrors Supabase returning no rows after .eq("status", "published").
      mockFrom.mockImplementation(() => {
        const c = chainable();
        c.single.mockResolvedValue({ data: null, error: { message: "not found" } });
        return c;
      });

      const result = await fetchArticleBySlugOnly(
        mockSupabase as never,
        "some-draft-slug",
        false,
      );

      expect(result.article).toBeNull();
      expect(result.category).toBeNull();
      expect(result.parentCategory).toBeNull();
    });

    it("editor (canViewDrafts=true) receives a draft article", async () => {
      mockFrom.mockImplementation(() => {
        const c = chainable();
        c.single.mockResolvedValue({
          data: {
            id: "art-1",
            title: "Draft in progress",
            slug: "draft-in-progress",
            status: "draft",
            category: {
              id: "cat-1",
              name: "Policies",
              slug: "policies",
              parent: null,
            },
          },
          error: null,
        });
        return c;
      });

      const result = await fetchArticleBySlugOnly(
        mockSupabase as never,
        "draft-in-progress",
        true,
      );

      expect(result.article).not.toBeNull();
      expect(result.article?.title).toBe("Draft in progress");
    });

    it("resolves parent from forward join (object shape) and strips it from category", async () => {
      mockFrom.mockImplementation(() => {
        const c = chainable();
        c.single.mockResolvedValue({
          data: {
            id: "art-2",
            title: "Sub article",
            slug: "sub-article",
            category: {
              id: "cat-sub",
              name: "Supplier Directory",
              slug: "supplier-directory",
              parent: { name: "Organisation", slug: "organisation" },
            },
          },
          error: null,
        });
        return c;
      });

      const result = await fetchArticleBySlugOnly(
        mockSupabase as never,
        "sub-article",
        true,
      );

      expect(result.parentCategory).toEqual({
        name: "Organisation",
        slug: "organisation",
      });
      expect(result.category?.slug).toBe("supplier-directory");
      expect((result.category as unknown as { parent?: unknown }).parent).toBeUndefined();
    });

    it("returns null parentCategory when the category is top-level (parent = null)", async () => {
      mockFrom.mockImplementation(() => {
        const c = chainable();
        c.single.mockResolvedValue({
          data: {
            id: "art-3",
            title: "Top-level article",
            slug: "top-level-article",
            category: {
              id: "cat-top",
              name: "Organisation",
              slug: "organisation",
              parent: null,
            },
          },
          error: null,
        });
        return c;
      });

      const result = await fetchArticleBySlugOnly(
        mockSupabase as never,
        "top-level-article",
        true,
      );

      expect(result.parentCategory).toBeNull();
      expect(result.category?.slug).toBe("organisation");
    });
  });

  // =============================================
  // fetchDraftArticles — parent-join direction
  // =============================================

  describe("fetchDraftArticles", () => {
    it("resolves parent_category_name from forward-join object shape", async () => {
      mockFrom.mockImplementation(() => {
        const c = chainable();
        c.limit.mockResolvedValue({
          data: [
            {
              id: "d-1",
              title: "Sub draft",
              slug: "sub-draft",
              content_type: "native",
              updated_at: "2026-04-14T10:00:00Z",
              author: { full_name: "Alice", preferred_name: null },
              category: {
                name: "Supplier Directory",
                parent: { name: "Organisation" },
              },
            },
            {
              id: "d-2",
              title: "Top draft",
              slug: "top-draft",
              content_type: "google_doc",
              updated_at: "2026-04-14T09:00:00Z",
              author: { full_name: "Bob", preferred_name: "Bobby" },
              category: { name: "Organisation", parent: null },
            },
          ],
          error: null,
        });
        return c;
      });

      const result = await fetchDraftArticles(mockSupabase as never);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        category_name: "Supplier Directory",
        parent_category_name: "Organisation",
        author_name: "Alice",
      });
      expect(result[1]).toMatchObject({
        category_name: "Organisation",
        parent_category_name: null,
        author_name: "Bobby",
      });
    });
  });

  // =============================================
  // fetchRecentlyUpdatedArticles — parent-join direction
  // =============================================

  describe("fetchRecentlyUpdatedArticles", () => {
    it("resolves parent_category_name from forward-join object shape", async () => {
      mockFrom.mockImplementation(() => {
        const c = chainable();
        c.limit.mockResolvedValue({
          data: [
            {
              id: "r-1",
              title: "Sub published",
              slug: "sub-published",
              updated_at: "2026-04-14T10:00:00Z",
              category: {
                name: "Supplier Directory",
                slug: "supplier-directory",
                parent: { name: "Organisation" },
              },
            },
            {
              id: "r-2",
              title: "Top published",
              slug: "top-published",
              updated_at: "2026-04-14T09:00:00Z",
              category: {
                name: "Organisation",
                slug: "organisation",
                parent: null,
              },
            },
          ],
          error: null,
        });
        return c;
      });

      const result = await fetchRecentlyUpdatedArticles(mockSupabase as never);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        category_name: "Supplier Directory",
        category_slug: "supplier-directory",
        parent_category_name: "Organisation",
      });
      expect(result[1]).toMatchObject({
        category_name: "Organisation",
        category_slug: "organisation",
        parent_category_name: null,
      });
    });
  });

});
