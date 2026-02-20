import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock strategy for intranet post actions:
 * - All actions use getCurrentUser() from @/lib/auth → { supabase, user, profile }
 * - We mock @/lib/auth directly to control auth state and the Supabase client
 * - The Supabase client is mocked as a plain object with fluent chain methods
 * - dns.lookup is mocked to control SSRF validation in fetchLinkPreview
 * - global.fetch is mocked for fetchLinkPreview HTTP requests
 *
 * This follows the pattern from hr/users/actions.test.ts: mock auth helpers,
 * not the low-level Supabase client.
 */

// ─── Hoisted mocks for Supabase fluent chains ────────────────────────

const mockEq = vi.hoisted(() => vi.fn());
const mockIn = vi.hoisted(() => vi.fn());
const mockSingle = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockStorageFrom = vi.hoisted(() => vi.fn());
const mockStorageRemove = vi.hoisted(() => vi.fn());

const mockSupabase = vi.hoisted(() => ({
  from: mockFrom,
  storage: { from: mockStorageFrom },
}));

const mockUser = vi.hoisted(() => ({
  id: "user-1",
  email: "staff@mcrpathways.org",
}));

const mockProfile = vi.hoisted(() => ({
  id: "user-1",
  full_name: "Test User",
  preferred_name: null,
  avatar_url: null,
  user_type: "staff" as const,
  status: "active" as const,
  is_hr_admin: false,
  is_ld_admin: false,
  is_line_manager: false,
  job_title: "Staff",
  induction_completed_at: "2026-01-01",
  last_sign_in_date: null,
  email: "staff@mcrpathways.org",
}));

// ─── Mock modules ────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    supabase: mockSupabase,
    user: mockUser,
    profile: mockProfile,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock dns.lookup for SSRF tests
vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn().mockResolvedValue({ address: "93.184.216.34" }),
  },
}));

// ─── Imports (after mocks) ───────────────────────────────────────────

import {
  createPost,
  editPost,
  deletePost,
  toggleReaction,
  addComment,
  fetchLinkPreview,
  _clearPreviewCacheForTesting,
} from "@/app/(protected)/intranet/actions";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import dns from "node:dns/promises";

// ─── Tests ───────────────────────────────────────────────────────────

describe("Intranet Post Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: getCurrentUser returns authenticated staff user
    vi.mocked(getCurrentUser).mockResolvedValue({
      supabase: mockSupabase as never,
      user: mockUser as never,
      profile: mockProfile as never,
    });

    // Default chain: .from(table).insert({}).select("id").single()
    mockSingle.mockResolvedValue({ data: { id: "post-1" }, error: null });
    mockSelect.mockReturnValue({ single: mockSingle, eq: mockEq, in: mockIn });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockIn.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      update: mockUpdate,
      delete: mockDelete,
    });

    // Storage mock
    mockStorageRemove.mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({ remove: mockStorageRemove });

    // DNS mock default: resolve to public IP
    vi.mocked(dns.lookup).mockResolvedValue({ address: "93.184.216.34", family: 4 } as never);
  });

  // ===========================================
  // createPost
  // ===========================================

  describe("createPost", () => {
    it("creates a post with valid content", async () => {
      const result = await createPost({ content: "Hello world!" });

      expect(result).toEqual({ success: true, error: null, postId: "post-1" });
      expect(mockFrom).toHaveBeenCalledWith("posts");
      expect(mockInsert).toHaveBeenCalledWith({
        author_id: "user-1",
        content: "Hello world!",
      });
      expect(revalidatePath).toHaveBeenCalledWith("/intranet");
    });

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase,
        user: null,
        profile: null,
      } as never);

      const result = await createPost({ content: "Hello" });

      expect(result).toEqual({ success: false, error: "Not authenticated" });
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("returns error when user is not staff", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase,
        user: mockUser,
        profile: { ...mockProfile, user_type: "pathways_coordinator" },
      } as never);

      const result = await createPost({ content: "Hello" });

      expect(result).toEqual({ success: false, error: "Only staff can create posts" });
    });

    it("returns error when content is empty", async () => {
      const result = await createPost({ content: "" });

      expect(result).toEqual({
        success: false,
        error: "Content must be between 1 and 5,000 characters",
      });
    });

    it("returns error when content is only whitespace", async () => {
      const result = await createPost({ content: "   " });

      expect(result).toEqual({
        success: false,
        error: "Content must be between 1 and 5,000 characters",
      });
    });

    it("returns error when content exceeds 5000 characters", async () => {
      const longContent = "a".repeat(5001);
      const result = await createPost({ content: longContent });

      expect(result).toEqual({
        success: false,
        error: "Content must be between 1 and 5,000 characters",
      });
    });

    it("trims whitespace from content before inserting", async () => {
      await createPost({ content: "  Hello world!  " });

      expect(mockInsert).toHaveBeenCalledWith({
        author_id: "user-1",
        content: "Hello world!",
      });
    });

    it("returns error when DB insert fails", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "Insert failed" },
      });

      const result = await createPost({ content: "Hello" });

      expect(result).toEqual({ success: false, error: "Insert failed" });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("creates a post with attachments", async () => {
      // Wire: first call is posts insert, second is post_attachments insert
      let callCount = 0;
      const mockAttInsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { insert: mockInsert };
        }
        return { insert: mockAttInsert };
      });

      const result = await createPost({
        content: "Post with link",
        attachments: [
          {
            attachment_type: "link",
            link_url: "https://example.com",
            link_title: "Example",
          },
        ],
      });

      expect(result).toEqual({ success: true, error: null, postId: "post-1" });
      expect(mockAttInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          post_id: "post-1",
          sort_order: 0,
          attachment_type: "link",
          link_url: "https://example.com",
          link_title: "Example",
        }),
      ]);
    });

    it("returns success with warning when attachment insert fails", async () => {
      let callCount = 0;
      const mockAttInsert = vi.fn().mockResolvedValue({
        error: { message: "Attachment insert failed" },
      });
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { insert: mockInsert };
        }
        return { insert: mockAttInsert };
      });

      const result = await createPost({
        content: "Post with broken attachment",
        attachments: [{ attachment_type: "image", file_url: "https://example.com/img.png" }],
      });

      expect(result.success).toBe(true);
      expect(result.postId).toBe("post-1");
      expect(result.warning).toBe("Post created, but some attachments could not be saved");
      expect(revalidatePath).toHaveBeenCalledWith("/intranet");
    });

    it("limits attachments to 10", async () => {
      let callCount = 0;
      const mockAttInsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { insert: mockInsert };
        }
        return { insert: mockAttInsert };
      });

      const attachments = Array.from({ length: 15 }, (_, i) => ({
        attachment_type: "link" as const,
        link_url: `https://example.com/${i}`,
      }));

      await createPost({ content: "Many attachments", attachments });

      // Should only insert 10 attachments
      const insertedAttachments = mockAttInsert.mock.calls[0][0];
      expect(insertedAttachments).toHaveLength(10);
    });
  });

  // ===========================================
  // editPost
  // ===========================================

  describe("editPost", () => {
    it("updates post content successfully", async () => {
      // .from("posts").update({content}).eq("id", postId).eq("author_id", userId)
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      const result = await editPost("post-1", { content: "Updated content" });

      expect(result).toEqual({ success: true, error: null });
      expect(mockFrom).toHaveBeenCalledWith("posts");
      expect(mockUpdate).toHaveBeenCalledWith({ content: "Updated content" });
      expect(mockEq).toHaveBeenCalledWith("id", "post-1");
      expect(mockEq2).toHaveBeenCalledWith("author_id", "user-1");
      expect(revalidatePath).toHaveBeenCalledWith("/intranet");
    });

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase,
        user: null,
        profile: null,
      } as never);

      const result = await editPost("post-1", { content: "Updated" });

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when content is empty", async () => {
      const result = await editPost("post-1", { content: "" });

      expect(result).toEqual({
        success: false,
        error: "Content must be between 1 and 5,000 characters",
      });
    });

    it("returns error when content exceeds 5000 characters", async () => {
      const result = await editPost("post-1", { content: "x".repeat(5001) });

      expect(result).toEqual({
        success: false,
        error: "Content must be between 1 and 5,000 characters",
      });
    });

    it("returns error when DB update fails", async () => {
      const mockEq2 = vi.fn().mockResolvedValue({
        error: { message: "Update failed" },
      });
      mockEq.mockReturnValue({ eq: mockEq2 });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      const result = await editPost("post-1", { content: "Updated" });

      expect(result).toEqual({ success: false, error: "Update failed" });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  // ===========================================
  // deletePost
  // ===========================================

  describe("deletePost", () => {
    it("deletes own post successfully", async () => {
      // First call: select author_id from posts
      const selectSingle = vi.fn().mockResolvedValue({
        data: { author_id: "user-1" },
        error: null,
      });
      const selectEq = vi.fn().mockReturnValue({ single: selectSingle });
      const selectChain = vi.fn().mockReturnValue({ eq: selectEq });

      // Second call: select file_url from post_attachments
      const attEq = vi.fn().mockResolvedValue({ data: [], error: null });
      const attSelect = vi.fn().mockReturnValue({ eq: attEq });

      // Third call: delete from posts
      const deleteEq = vi.fn().mockResolvedValue({ error: null });
      const deleteChain = vi.fn().mockReturnValue({ eq: deleteEq });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: selectChain };
        if (callCount === 2) return { select: attSelect };
        return { delete: deleteChain };
      });

      const result = await deletePost("post-1");

      expect(result).toEqual({ success: true, error: null });
      expect(revalidatePath).toHaveBeenCalledWith("/intranet");
    });

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase,
        user: null,
        profile: null,
      } as never);

      const result = await deletePost("post-1");

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when post is not found", async () => {
      const selectSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const selectEq = vi.fn().mockReturnValue({ single: selectSingle });
      const selectChain = vi.fn().mockReturnValue({ eq: selectEq });
      mockFrom.mockReturnValue({ select: selectChain });

      const result = await deletePost("nonexistent");

      expect(result).toEqual({ success: false, error: "Post not found" });
    });

    it("returns error when user is not the author and not HR admin", async () => {
      const selectSingle = vi.fn().mockResolvedValue({
        data: { author_id: "other-user" },
        error: null,
      });
      const selectEq = vi.fn().mockReturnValue({ single: selectSingle });
      const selectChain = vi.fn().mockReturnValue({ eq: selectEq });
      mockFrom.mockReturnValue({ select: selectChain });

      const result = await deletePost("post-1");

      expect(result).toEqual({
        success: false,
        error: "Not authorized to delete this post",
      });
    });

    it("allows HR admin to delete another user's post", async () => {
      // Set profile to HR admin
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase,
        user: mockUser,
        profile: { ...mockProfile, is_hr_admin: true },
      } as never);

      // Post authored by someone else
      const selectSingle = vi.fn().mockResolvedValue({
        data: { author_id: "other-user" },
        error: null,
      });
      const selectEq = vi.fn().mockReturnValue({ single: selectSingle });
      const selectChain = vi.fn().mockReturnValue({ eq: selectEq });

      // Attachments query
      const attEq = vi.fn().mockResolvedValue({ data: [], error: null });
      const attSelect = vi.fn().mockReturnValue({ eq: attEq });

      // Delete
      const deleteEq = vi.fn().mockResolvedValue({ error: null });
      const deleteChain = vi.fn().mockReturnValue({ eq: deleteEq });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: selectChain };
        if (callCount === 2) return { select: attSelect };
        return { delete: deleteChain };
      });

      const result = await deletePost("post-1");

      expect(result).toEqual({ success: true, error: null });
    });

    it("returns error when DB delete fails", async () => {
      const selectSingle = vi.fn().mockResolvedValue({
        data: { author_id: "user-1" },
        error: null,
      });
      const selectEq = vi.fn().mockReturnValue({ single: selectSingle });
      const selectChain = vi.fn().mockReturnValue({ eq: selectEq });

      // Attachments query
      const attEq = vi.fn().mockResolvedValue({ data: [], error: null });
      const attSelect = vi.fn().mockReturnValue({ eq: attEq });

      // Delete fails
      const deleteEq = vi.fn().mockResolvedValue({
        error: { message: "Delete failed" },
      });
      const deleteChain = vi.fn().mockReturnValue({ eq: deleteEq });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: selectChain };
        if (callCount === 2) return { select: attSelect };
        return { delete: deleteChain };
      });

      const result = await deletePost("post-1");

      expect(result).toEqual({ success: false, error: "Delete failed" });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("cleans up storage files when post has attachments", async () => {
      // Post lookup
      const selectSingle = vi.fn().mockResolvedValue({
        data: { author_id: "user-1" },
        error: null,
      });
      const selectEq = vi.fn().mockReturnValue({ single: selectSingle });
      const selectChain = vi.fn().mockReturnValue({ eq: selectEq });

      // Attachments with file URLs
      const attEq = vi.fn().mockResolvedValue({
        data: [
          { file_url: "https://storage.supabase.co/storage/v1/object/public/post-attachments/user-1/abc.png" },
          { file_url: null },
        ],
        error: null,
      });
      const attSelect = vi.fn().mockReturnValue({ eq: attEq });

      // Delete
      const deleteEq = vi.fn().mockResolvedValue({ error: null });
      const deleteChain = vi.fn().mockReturnValue({ eq: deleteEq });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: selectChain };
        if (callCount === 2) return { select: attSelect };
        return { delete: deleteChain };
      });

      const result = await deletePost("post-1");

      expect(result).toEqual({ success: true, error: null });
      expect(mockStorageFrom).toHaveBeenCalledWith("post-attachments");
      expect(mockStorageRemove).toHaveBeenCalledWith(["user-1/abc.png"]);
    });
  });

  // ===========================================
  // toggleReaction
  // ===========================================

  describe("toggleReaction", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase,
        user: null,
        profile: null,
      } as never);

      const result = await toggleReaction("post-1", "like");

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error for invalid reaction type", async () => {
      const result = await toggleReaction("post-1", "angry" as never);

      expect(result).toEqual({ success: false, error: "Invalid reaction type" });
    });

    it("creates a new reaction when none exists", async () => {
      // Existing reaction check: .from().select().eq().eq().single() → null
      const selectSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const selectEq2 = vi.fn().mockReturnValue({ single: selectSingle });
      const selectEq1 = vi.fn().mockReturnValue({ eq: selectEq2 });
      const selectChain = vi.fn().mockReturnValue({ eq: selectEq1 });

      // Insert reaction
      const insertChain = vi.fn().mockResolvedValue({ error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: selectChain };
        return { insert: insertChain };
      });

      const result = await toggleReaction("post-1", "like");

      expect(result).toEqual({ success: true, error: null });
      expect(insertChain).toHaveBeenCalledWith({
        post_id: "post-1",
        user_id: "user-1",
        reaction_type: "like",
      });
      expect(revalidatePath).toHaveBeenCalledWith("/intranet");
    });

    it("removes reaction when toggling same type (toggle off)", async () => {
      // Existing reaction check: returns same reaction type
      const selectSingle = vi.fn().mockResolvedValue({
        data: { id: "reaction-1", reaction_type: "like" },
        error: null,
      });
      const selectEq2 = vi.fn().mockReturnValue({ single: selectSingle });
      const selectEq1 = vi.fn().mockReturnValue({ eq: selectEq2 });
      const selectChain = vi.fn().mockReturnValue({ eq: selectEq1 });

      // Delete reaction
      const deleteEq = vi.fn().mockResolvedValue({ error: null });
      const deleteChain = vi.fn().mockReturnValue({ eq: deleteEq });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: selectChain };
        return { delete: deleteChain };
      });

      const result = await toggleReaction("post-1", "like");

      expect(result).toEqual({ success: true, error: null });
      expect(deleteEq).toHaveBeenCalledWith("id", "reaction-1");
    });

    it("updates reaction when toggling different type", async () => {
      // Existing reaction check: returns different reaction type
      const selectSingle = vi.fn().mockResolvedValue({
        data: { id: "reaction-1", reaction_type: "like" },
        error: null,
      });
      const selectEq2 = vi.fn().mockReturnValue({ single: selectSingle });
      const selectEq1 = vi.fn().mockReturnValue({ eq: selectEq2 });
      const selectChain = vi.fn().mockReturnValue({ eq: selectEq1 });

      // Update reaction
      const updateEq = vi.fn().mockResolvedValue({ error: null });
      const updateChain = vi.fn().mockReturnValue({ eq: updateEq });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: selectChain };
        return { update: updateChain };
      });

      const result = await toggleReaction("post-1", "love");

      expect(result).toEqual({ success: true, error: null });
      expect(updateChain).toHaveBeenCalledWith({ reaction_type: "love" });
      expect(updateEq).toHaveBeenCalledWith("id", "reaction-1");
    });
  });

  // ===========================================
  // addComment
  // ===========================================

  describe("addComment", () => {
    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase,
        user: null,
        profile: null,
      } as never);

      const result = await addComment("post-1", "Nice post!");

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when content is empty", async () => {
      const result = await addComment("post-1", "");

      expect(result).toEqual({
        success: false,
        error: "Comment must be between 1 and 2000 characters",
      });
    });

    it("returns error when content is only whitespace", async () => {
      const result = await addComment("post-1", "   ");

      expect(result).toEqual({
        success: false,
        error: "Comment must be between 1 and 2000 characters",
      });
    });

    it("returns error when content exceeds 2000 characters", async () => {
      const result = await addComment("post-1", "a".repeat(2001));

      expect(result).toEqual({
        success: false,
        error: "Comment must be between 1 and 2000 characters",
      });
    });

    it("creates a top-level comment successfully", async () => {
      // Insert: .from("post_comments").insert({...}).select("id").single()
      const insertSingle = vi.fn().mockResolvedValue({
        data: { id: "comment-1" },
        error: null,
      });
      const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
      const insertChain = vi.fn().mockReturnValue({ select: insertSelect });
      mockFrom.mockReturnValue({ insert: insertChain });

      const result = await addComment("post-1", "Nice post!");

      expect(result).toEqual({ success: true, error: null, commentId: "comment-1" });
      expect(insertChain).toHaveBeenCalledWith({
        post_id: "post-1",
        author_id: "user-1",
        content: "Nice post!",
      });
      expect(revalidatePath).toHaveBeenCalledWith("/intranet");
    });

    it("creates a reply to a top-level comment", async () => {
      // First call: validate parent comment
      const parentSingle = vi.fn().mockResolvedValue({
        data: { id: "parent-1", post_id: "post-1", parent_id: null },
        error: null,
      });
      const parentEq = vi.fn().mockReturnValue({ single: parentSingle });
      const parentSelect = vi.fn().mockReturnValue({ eq: parentEq });

      // Second call: insert reply
      const insertSingle = vi.fn().mockResolvedValue({
        data: { id: "reply-1" },
        error: null,
      });
      const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
      const insertChain = vi.fn().mockReturnValue({ select: insertSelect });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: parentSelect };
        return { insert: insertChain };
      });

      const result = await addComment("post-1", "Great reply!", "parent-1");

      expect(result).toEqual({ success: true, error: null, commentId: "reply-1" });
      expect(insertChain).toHaveBeenCalledWith({
        post_id: "post-1",
        author_id: "user-1",
        content: "Great reply!",
        parent_id: "parent-1",
      });
    });

    it("returns error when parent comment not found", async () => {
      const parentSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const parentEq = vi.fn().mockReturnValue({ single: parentSingle });
      const parentSelect = vi.fn().mockReturnValue({ eq: parentEq });
      mockFrom.mockReturnValue({ select: parentSelect });

      const result = await addComment("post-1", "Reply", "nonexistent");

      expect(result).toEqual({
        success: false,
        error: "Parent comment not found",
      });
    });

    it("returns error when parent comment belongs to a different post", async () => {
      const parentSingle = vi.fn().mockResolvedValue({
        data: { id: "parent-1", post_id: "other-post", parent_id: null },
        error: null,
      });
      const parentEq = vi.fn().mockReturnValue({ single: parentSingle });
      const parentSelect = vi.fn().mockReturnValue({ eq: parentEq });
      mockFrom.mockReturnValue({ select: parentSelect });

      const result = await addComment("post-1", "Reply", "parent-1");

      expect(result).toEqual({
        success: false,
        error: "Parent comment belongs to a different post",
      });
    });

    it("returns error when replying to a reply (no nested replies)", async () => {
      const parentSingle = vi.fn().mockResolvedValue({
        data: { id: "reply-1", post_id: "post-1", parent_id: "parent-1" },
        error: null,
      });
      const parentEq = vi.fn().mockReturnValue({ single: parentSingle });
      const parentSelect = vi.fn().mockReturnValue({ eq: parentEq });
      mockFrom.mockReturnValue({ select: parentSelect });

      const result = await addComment("post-1", "Nested reply", "reply-1");

      expect(result).toEqual({
        success: false,
        error: "Cannot reply to a reply",
      });
    });

    it("returns error when DB insert fails", async () => {
      const insertSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Insert failed" },
      });
      const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
      const insertChain = vi.fn().mockReturnValue({ select: insertSelect });
      mockFrom.mockReturnValue({ insert: insertChain });

      const result = await addComment("post-1", "Test comment");

      expect(result).toEqual({ success: false, error: "Insert failed" });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  // ===========================================
  // fetchLinkPreview
  // ===========================================

  describe("fetchLinkPreview", () => {
    beforeEach(() => {
      // Mock global fetch for link preview requests
      vi.stubGlobal("fetch", vi.fn());
      // Clear server-side preview cache between tests
      _clearPreviewCacheForTesting();
    });

    it("returns error when not authenticated", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase,
        user: null,
        profile: null,
      } as never);

      const result = await fetchLinkPreview("https://example.com");

      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("returns error when user is not staff", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        supabase: mockSupabase,
        user: mockUser,
        profile: { ...mockProfile, user_type: "pathways_coordinator" },
      } as never);

      const result = await fetchLinkPreview("https://example.com");

      expect(result).toEqual({
        success: false,
        error: "Only staff can fetch link previews",
      });
    });

    it("returns error for non-HTTP protocol", async () => {
      const result = await fetchLinkPreview("ftp://example.com/file.txt");

      expect(result).toEqual({ success: false, error: "Failed to fetch link preview" });
    });

    it("returns error for invalid URL", async () => {
      const result = await fetchLinkPreview("not-a-url");

      // URL constructor will throw, caught by try/catch
      expect(result).toEqual({
        success: false,
        error: "Failed to fetch link preview",
      });
    });

    // ─── SSRF Protection Tests ────────────────────────────────────────

    it("blocks URLs resolving to 127.0.0.1 (loopback)", async () => {
      vi.mocked(dns.lookup).mockResolvedValue({ address: "127.0.0.1", family: 4 } as never);

      const result = await fetchLinkPreview("https://evil.example.com");

      expect(result).toEqual({
        success: false,
        error: "Failed to fetch link preview",
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    it("blocks URLs resolving to 10.x.x.x (private)", async () => {
      vi.mocked(dns.lookup).mockResolvedValue({ address: "10.0.0.1", family: 4 } as never);

      const result = await fetchLinkPreview("https://internal.example.com");

      expect(result).toEqual({
        success: false,
        error: "Failed to fetch link preview",
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    it("blocks URLs resolving to 172.16.x.x (private)", async () => {
      vi.mocked(dns.lookup).mockResolvedValue({ address: "172.16.0.1", family: 4 } as never);

      const result = await fetchLinkPreview("https://internal.example.com");

      expect(result).toEqual({
        success: false,
        error: "Failed to fetch link preview",
      });
    });

    it("blocks URLs resolving to 192.168.x.x (private)", async () => {
      vi.mocked(dns.lookup).mockResolvedValue({ address: "192.168.1.1", family: 4 } as never);

      const result = await fetchLinkPreview("https://internal.example.com");

      expect(result).toEqual({
        success: false,
        error: "Failed to fetch link preview",
      });
    });

    it("blocks URLs resolving to 169.254.x.x (cloud metadata / link-local)", async () => {
      vi.mocked(dns.lookup).mockResolvedValue({ address: "169.254.169.254", family: 4 } as never);

      const result = await fetchLinkPreview("https://metadata.example.com");

      expect(result).toEqual({
        success: false,
        error: "Failed to fetch link preview",
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    it("blocks URLs with direct private IP hostnames", async () => {
      const result = await fetchLinkPreview("https://127.0.0.1/admin");

      expect(result).toEqual({
        success: false,
        error: "Failed to fetch link preview",
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    it("blocks URLs resolving to 0.0.0.0", async () => {
      vi.mocked(dns.lookup).mockResolvedValue({ address: "0.0.0.0", family: 4 } as never);

      const result = await fetchLinkPreview("https://zero.example.com");

      expect(result).toEqual({
        success: false,
        error: "Failed to fetch link preview",
      });
    });

    it("blocks when DNS resolution fails", async () => {
      vi.mocked(dns.lookup).mockRejectedValue(new Error("DNS resolution failed"));

      const result = await fetchLinkPreview("https://nonexistent.example.com");

      expect(result).toEqual({
        success: false,
        error: "Failed to fetch link preview",
      });
    });

    // ─── Successful preview extraction ───────────────────────────────

    it("extracts Open Graph metadata from HTML", async () => {
      vi.mocked(dns.lookup).mockResolvedValue({ address: "93.184.216.34", family: 4 } as never);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            `<html><head>
              <meta property="og:title" content="Example Page" />
              <meta property="og:description" content="A description of the page" />
              <meta property="og:image" content="https://example.com/image.png" />
            </head></html>`
          ),
      } as Response);

      const result = await fetchLinkPreview("https://example.com");

      expect(result).toEqual({
        success: true,
        error: null,
        title: "Example Page",
        description: "A description of the page",
        imageUrl: "https://example.com/image.png",
      });
    });

    it("falls back to <title> tag when og:title is missing", async () => {
      vi.mocked(dns.lookup).mockResolvedValue({ address: "93.184.216.34", family: 4 } as never);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            `<html><head><title>Fallback Title</title></head></html>`
          ),
      } as Response);

      const result = await fetchLinkPreview("https://example.com");

      expect(result.success).toBe(true);
      expect(result.title).toBe("Fallback Title");
    });

    it("returns error when fetch response is not OK", async () => {
      vi.mocked(dns.lookup).mockResolvedValue({ address: "93.184.216.34", family: 4 } as never);
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const result = await fetchLinkPreview("https://example.com/404");

      expect(result).toEqual({ success: false, error: "Failed to fetch link preview" });
    });

    it("returns error when fetch throws (e.g. timeout)", async () => {
      vi.mocked(dns.lookup).mockResolvedValue({ address: "93.184.216.34", family: 4 } as never);
      vi.mocked(fetch).mockRejectedValue(new Error("Timeout"));

      const result = await fetchLinkPreview("https://slow.example.com");

      expect(result).toEqual({
        success: false,
        error: "Failed to fetch link preview",
      });
    });

    it("truncates title to 200 characters", async () => {
      vi.mocked(dns.lookup).mockResolvedValue({ address: "93.184.216.34", family: 4 } as never);
      const longTitle = "A".repeat(300);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            `<html><head><meta property="og:title" content="${longTitle}" /></head></html>`
          ),
      } as Response);

      const result = await fetchLinkPreview("https://example.com");

      expect(result.success).toBe(true);
      expect(result.title).toHaveLength(200);
    });

    it("truncates description to 500 characters", async () => {
      vi.mocked(dns.lookup).mockResolvedValue({ address: "93.184.216.34", family: 4 } as never);
      const longDesc = "B".repeat(600);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            `<html><head><meta property="og:description" content="${longDesc}" /></head></html>`
          ),
      } as Response);

      const result = await fetchLinkPreview("https://example.com");

      expect(result.success).toBe(true);
      expect(result.description).toHaveLength(500);
    });
  });
});
