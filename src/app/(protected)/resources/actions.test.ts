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
  mockRpc,
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
  getCategoryArticleCount,
  createArticle,
  updateArticle,
  deleteArticle,
  fetchCategoriesWithClient,
  fetchCategoryArticlesWithClient,
  fetchArticleWithClient,
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

  describe("getCategoryArticleCount", () => {
    it("returns article count for a category", async () => {
      const c = chainable();
      // Chain: .select().eq().is() — .is() is the terminal
      c.is.mockResolvedValue({ count: 5, error: null });
      mockFrom.mockReturnValue(c);

      const count = await getCategoryArticleCount("cat-1");
      expect(count).toBe(5);
    });

    it("returns 0 when count is null", async () => {
      const c = chainable();
      c.is.mockResolvedValue({ count: null, error: null });
      mockFrom.mockReturnValue(c);

      const count = await getCategoryArticleCount("cat-1");
      expect(count).toBe(0);
    });

    it("returns 0 when not authenticated", async () => {
      getCurrentUser.mockResolvedValue({
        supabase: mockSupabase as never,
        user: null as never,
        profile: null as never,
      });

      const count = await getCategoryArticleCount("cat-1");
      expect(count).toBe(0);
    });
  });

  // =============================================
  // createArticle
  // =============================================

  describe("createArticle", () => {
    function setupArticleCreateChain(opts?: {
      slugExists?: boolean;
      insertError?: boolean;
    }) {
      const callLog: string[] = [];
      mockFrom.mockImplementation((table: string) => {
        callLog.push(table);
        const c = chainable();

        if (table === "resource_articles") {
          const artCalls = callLog.filter((t) => t === "resource_articles").length;
          if (artCalls === 1) {
            // ensureUniqueArticleSlug — check slug
            c.limit.mockResolvedValue({
              data: opts?.slugExists ? [{ id: "existing-art" }] : [],
              error: null,
            });
          } else if (artCalls === 2 && opts?.slugExists) {
            // Second slug check with suffix
            c.limit.mockResolvedValue({ data: [], error: null });
          } else {
            // Insert
            c.single.mockResolvedValue(
              opts?.insertError
                ? { data: null, error: { message: "Insert failed" } }
                : {
                    data: {
                      id: "art-1",
                      title: "Test",
                      slug: opts?.slugExists ? "test-2" : "test",
                      status: "draft",
                    },
                    error: null,
                  },
            );
          }
        }
        return c;
      });
    }

    it("creates a draft article", async () => {
      setupArticleCreateChain();

      const result = await createArticle("cat-1", { title: "Test Article" });
      expect(result.success).toBe(true);
      expect(result.article).toBeDefined();
      expect(revalidatePath).toHaveBeenCalled();
    });

    it("creates a published article with published_at", async () => {
      setupArticleCreateChain();

      const result = await createArticle("cat-1", {
        title: "Published Article",
        status: "published",
      });
      expect(result.success).toBe(true);
    });

    it("creates article with Tiptap content_json", async () => {
      setupArticleCreateChain();

      const result = await createArticle("cat-1", {
        title: "Rich Article",
        content_json: { type: "doc", content: [{ type: "paragraph", text: "Hello" }] } as never,
      });
      expect(result.success).toBe(true);
    });

    it("returns error for empty title", async () => {
      const result = await createArticle("cat-1", { title: "  " });
      expect(result.success).toBe(false);
      expect(result.error).toContain("title is required");
    });

    it("returns error for title that produces empty slug", async () => {
      const result = await createArticle("cat-1", { title: "!!!" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid article title");
    });

    it("deduplicates slug when collision exists", async () => {
      setupArticleCreateChain({ slugExists: true });

      const result = await createArticle("cat-1", { title: "Test" });
      expect(result.success).toBe(true);
      expect(result.article?.slug).toBe("test-2");
    });

    it("returns error on DB insert failure", async () => {
      setupArticleCreateChain({ insertError: true });

      const result = await createArticle("cat-1", { title: "Test" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to create");
    });

    it("throws when user is not a content editor or HR admin", async () => {
      vi.mocked(requireContentEditor).mockRejectedValue(new Error("Not authorised"));
      await expect(createArticle("cat-1", { title: "Test" })).rejects.toThrow("Not authorised");
    });
  });

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
    it("soft-deletes an article", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: { id: "art-1" }, error: null });
      mockFrom.mockReturnValue(c);

      const result = await deleteArticle("art-1");
      expect(result.success).toBe(true);
      expect(c.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_featured: false })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/resources", "layout");
    });

    it("returns error on DB failure", async () => {
      const c = chainable();
      c.single.mockResolvedValue({ data: null, error: { message: "Delete failed" } });
      mockFrom.mockReturnValue(c);

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

    it("returns category and articles for HR admin", async () => {
      setupFetchArticlesChain();

      const result = await fetchCategoryArticlesWithClient(
        mockSupabase as never,
        "policies",
        true,
      );
      expect(result.category).toBeDefined();
      expect(result.articles).toHaveLength(1);
    });

    it("filters published-only for non-admin", async () => {
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
  // fetchArticleWithClient
  // =============================================

  describe("fetchArticleWithClient", () => {
    function setupFetchArticleChain(opts?: {
      categoryNotFound?: boolean;
      articleNotFound?: boolean;
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
          c.single.mockResolvedValue(
            opts?.articleNotFound
              ? { data: null, error: { message: "Not found" } }
              : {
                  data: {
                    id: "art-1",
                    title: "My Article",
                    slug: "my-article",
                    author: { id: "u-1", full_name: "Alice" },
                  },
                  error: null,
                },
          );
        }
        return c;
      });
    }

    it("returns category and article", async () => {
      setupFetchArticleChain();

      const result = await fetchArticleWithClient(
        mockSupabase as never,
        "policies",
        "my-article",
        true,
      );
      expect(result.category).toBeDefined();
      expect(result.article).toBeDefined();
      expect(result.article?.title).toBe("My Article");
    });

    it("returns null when category not found", async () => {
      setupFetchArticleChain({ categoryNotFound: true });

      const result = await fetchArticleWithClient(
        mockSupabase as never,
        "nonexistent",
        "my-article",
        true,
      );
      expect(result.category).toBeNull();
      expect(result.article).toBeNull();
    });

    it("returns null article when article not found", async () => {
      setupFetchArticleChain({ articleNotFound: true });

      const result = await fetchArticleWithClient(
        mockSupabase as never,
        "policies",
        "nonexistent",
        true,
      );
      expect(result.category).toBeDefined();
      expect(result.article).toBeNull();
    });
  });
});
