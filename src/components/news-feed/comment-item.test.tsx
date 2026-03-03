/**
 * Tests for CommentItem component.
 *
 * Covers: three-dot menu visibility, edit mode, delete confirmation,
 * reaction display, reply link, and edited indicator.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentItem } from "./comment-item";
import type { CommentWithAuthor, ReactionType } from "@/types/database.types";

// Mock server actions
const mockEditComment = vi.fn().mockResolvedValue({ success: true });
const mockDeleteComment = vi.fn().mockResolvedValue({ success: true });
const mockToggleCommentReaction = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/app/(protected)/intranet/actions", () => ({
  editComment: (...args: unknown[]) => mockEditComment(...args),
  deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  toggleCommentReaction: (...args: unknown[]) => mockToggleCommentReaction(...args),
}));

// Mock TiptapRenderer as simple div showing text
vi.mock("./tiptap-renderer", () => ({
  TiptapRenderer: ({ fallback }: { fallback: string }) => (
    <div data-testid="tiptap-renderer">{fallback}</div>
  ),
}));

// Mock linkifyText for TiptapRenderer
vi.mock("@/lib/url", () => ({
  linkifyText: vi.fn((text: string) => [text]),
}));

// Mock reaction constants (all 5 reactions)
vi.mock("./reaction-constants", () => ({
  REACTIONS: [
    { type: "like", emoji: "👍", label: "Like" },
    { type: "love", emoji: "❤️", label: "Love" },
    { type: "celebrate", emoji: "🎉", label: "Celebrate" },
    { type: "insightful", emoji: "💡", label: "Insightful" },
    { type: "curious", emoji: "🤔", label: "Curious" },
  ],
  REACTION_COLORS: {
    like: "text-blue-500",
    love: "text-red-500",
    celebrate: "text-yellow-500",
    insightful: "text-yellow-500",
    curious: "text-yellow-500",
  },
}));

const defaultReactionCounts: Record<ReactionType, number> = {
  like: 0,
  love: 0,
  celebrate: 0,
  insightful: 0,
  curious: 0,
};

function makeComment(overrides?: Partial<CommentWithAuthor>): CommentWithAuthor {
  return {
    id: "comment-1",
    post_id: "post-1",
    author_id: "user-2",
    content: "Great post!",
    content_json: null,
    parent_id: null,
    created_at: "2026-01-15T10:00:00Z",
    updated_at: "2026-01-15T10:00:00Z",
    author: {
      id: "user-2",
      full_name: "Bob Jones",
      preferred_name: null,
      avatar_url: null,
    },
    reactions: [],
    reaction_counts: { ...defaultReactionCounts },
    user_reaction: null,
    replies: [],
    ...overrides,
  };
}

const defaultProps = {
  currentUserId: "user-1",
  isHRAdmin: false,
  onOptimisticReaction: vi.fn(),
};

describe("CommentItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =============================================
  // Basic rendering
  // =============================================

  it("renders comment content and author name", () => {
    render(
      <CommentItem
        {...defaultProps}
        comment={makeComment()}
      />
    );
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("Great post!")).toBeInTheDocument();
  });

  it("shows preferred name when available", () => {
    render(
      <CommentItem
        {...defaultProps}
        comment={makeComment({
          author: {
            id: "user-2",
            full_name: "Robert Jones",
            preferred_name: "Bob",
            avatar_url: null,
          },
        })}
      />
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows (edited) indicator when updated_at differs from created_at", () => {
    render(
      <CommentItem
        {...defaultProps}
        comment={makeComment({
          created_at: "2026-01-15T10:00:00Z",
          updated_at: "2026-01-15T11:00:00Z",
        })}
      />
    );
    expect(screen.getByText("(edited)")).toBeInTheDocument();
  });

  it("does not show (edited) when timestamps match", () => {
    render(
      <CommentItem
        {...defaultProps}
        comment={makeComment()}
      />
    );
    expect(screen.queryByText("(edited)")).not.toBeInTheDocument();
  });

  // =============================================
  // Three-dot menu visibility
  // =============================================

  it("shows three-dot menu for comment author", () => {
    render(
      <CommentItem
        {...defaultProps}
        currentUserId="user-2"
        comment={makeComment({ author_id: "user-2" })}
      />
    );
    // Menu trigger button exists (MoreHorizontal icon)
    const menuButtons = screen.getAllByRole("button");
    const moreButton = menuButtons.find(
      (b) => b.querySelector("svg.lucide-ellipsis")
    );
    expect(moreButton).toBeDefined();
  });

  it("shows three-dot menu for HR admin (non-author)", () => {
    render(
      <CommentItem
        {...defaultProps}
        isHRAdmin={true}
        comment={makeComment({ author_id: "user-2" })}
      />
    );
    const menuButtons = screen.getAllByRole("button");
    const moreButton = menuButtons.find(
      (b) => b.querySelector("svg.lucide-ellipsis")
    );
    expect(moreButton).toBeDefined();
  });

  it("hides three-dot menu for non-author non-admin", () => {
    render(
      <CommentItem
        {...defaultProps}
        currentUserId="user-3"
        isHRAdmin={false}
        comment={makeComment({ author_id: "user-2" })}
      />
    );
    const menuButtons = screen.getAllByRole("button");
    const moreButton = menuButtons.find(
      (b) => b.querySelector("svg.lucide-ellipsis")
    );
    expect(moreButton).toBeUndefined();
  });

  // =============================================
  // Reply link
  // =============================================

  it("shows Reply link for top-level comment with onReplyClick", () => {
    const onReplyClick = vi.fn();
    render(
      <CommentItem
        {...defaultProps}
        comment={makeComment()}
        onReplyClick={onReplyClick}
        isReply={false}
      />
    );
    expect(screen.getByText("Reply")).toBeInTheDocument();
  });

  it("hides Reply link for replies", () => {
    render(
      <CommentItem
        {...defaultProps}
        comment={makeComment()}
        onReplyClick={vi.fn()}
        isReply={true}
      />
    );
    expect(screen.queryByText("Reply")).not.toBeInTheDocument();
  });

  it("hides Reply link when onReplyClick not provided", () => {
    render(
      <CommentItem
        {...defaultProps}
        comment={makeComment()}
        isReply={false}
      />
    );
    expect(screen.queryByText("Reply")).not.toBeInTheDocument();
  });

  // =============================================
  // Reactions
  // =============================================

  it("shows reaction badge when reactions exist", () => {
    render(
      <CommentItem
        {...defaultProps}
        comment={makeComment({
          reaction_counts: { ...defaultReactionCounts, like: 3, love: 1 },
        })}
      />
    );
    // Total count displayed (4)
    expect(screen.getByText("4")).toBeInTheDocument();
    // Emoji badges
    expect(screen.getByText("👍")).toBeInTheDocument();
    expect(screen.getByText("❤️")).toBeInTheDocument();
  });

  it("hides reaction badge when no reactions", () => {
    render(
      <CommentItem
        {...defaultProps}
        comment={makeComment()}
      />
    );
    // No reaction emojis or count should be visible
    expect(screen.queryByText("👍")).not.toBeInTheDocument();
    expect(screen.queryByText("❤️")).not.toBeInTheDocument();
  });

  it("shows current user reaction label instead of Like", () => {
    render(
      <CommentItem
        {...defaultProps}
        comment={makeComment({
          user_reaction: "love",
          reaction_counts: { ...defaultReactionCounts, love: 1 },
        })}
      />
    );
    expect(screen.getByText("Love")).toBeInTheDocument();
    expect(screen.queryByText("Like")).not.toBeInTheDocument();
  });

  // =============================================
  // Delete confirmation
  // =============================================

  it("shows delete confirmation with reply warning for comments with replies", async () => {
    const user = userEvent.setup();
    const comment = makeComment({
      author_id: "user-1",
      replies: [makeComment({ id: "reply-1", parent_id: "comment-1" })],
    });
    render(
      <CommentItem
        {...defaultProps}
        currentUserId="user-1"
        comment={comment}
      />
    );

    // Open dropdown menu
    const menuButtons = screen.getAllByRole("button");
    const moreButton = menuButtons.find(
      (b) => b.querySelector("svg.lucide-ellipsis")
    );
    await user.click(moreButton!);

    // Click Delete
    const deleteItem = await screen.findByText("Delete");
    await user.click(deleteItem);

    // Confirmation dialog should show with cascade warning
    expect(
      await screen.findByText(/All replies will also be removed/)
    ).toBeInTheDocument();
  });

  // =============================================
  // Interaction: delete confirmation
  // =============================================

  it("calls deleteComment when delete is confirmed", async () => {
    const user = userEvent.setup();
    render(
      <CommentItem
        {...defaultProps}
        currentUserId="user-1"
        comment={makeComment({ author_id: "user-1" })}
      />
    );

    // Open dropdown → click Delete
    const moreButton = screen.getAllByRole("button").find(
      (b) => b.querySelector("svg.lucide-ellipsis")
    );
    await user.click(moreButton!);
    await user.click(await screen.findByText("Delete"));

    // Confirm in the dialog
    const confirmDeleteButtons = await screen.findAllByRole("button", { name: "Delete" });
    // The dialog "Delete" button (not the dropdown item)
    await user.click(confirmDeleteButtons[confirmDeleteButtons.length - 1]);

    expect(mockDeleteComment).toHaveBeenCalledWith("comment-1");
  });

  // =============================================
  // Interaction: edit mode
  // =============================================

  it("enters edit mode and saves edited comment", async () => {
    const user = userEvent.setup();
    render(
      <CommentItem
        {...defaultProps}
        currentUserId="user-2"
        comment={makeComment({ author_id: "user-2" })}
      />
    );

    // Open dropdown → click Edit
    const moreButton = screen.getAllByRole("button").find(
      (b) => b.querySelector("svg.lucide-ellipsis")
    );
    await user.click(moreButton!);
    await user.click(await screen.findByText("Edit"));

    // Textarea should appear with existing content
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("Great post!");

    // Clear and type new content
    await user.clear(textarea);
    await user.type(textarea, "Updated comment!");

    // Click save (checkmark button)
    const saveButton = screen.getAllByRole("button").find(
      (b) => b.querySelector("svg.lucide-check")
    );
    await user.click(saveButton!);

    expect(mockEditComment).toHaveBeenCalledWith(
      "comment-1",
      "Updated comment!"
    );
  });

  it("cancels edit mode without calling editComment", async () => {
    const user = userEvent.setup();
    render(
      <CommentItem
        {...defaultProps}
        currentUserId="user-2"
        comment={makeComment({ author_id: "user-2" })}
      />
    );

    // Open dropdown → click Edit
    const moreButton = screen.getAllByRole("button").find(
      (b) => b.querySelector("svg.lucide-ellipsis")
    );
    await user.click(moreButton!);
    await user.click(await screen.findByText("Edit"));

    // Click cancel (X button)
    const cancelButton = screen.getAllByRole("button").find(
      (b) => b.querySelector("svg.lucide-x")
    );
    await user.click(cancelButton!);

    // Textarea should be gone, original content visible
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Great post!")).toBeInTheDocument();
    expect(mockEditComment).not.toHaveBeenCalled();
  });

  // =============================================
  // Interaction: reactions
  // =============================================

  it("calls onOptimisticReaction when Like is clicked", async () => {
    const user = userEvent.setup();
    const onOptimisticReaction = vi.fn();
    render(
      <CommentItem
        currentUserId="user-1"
        isHRAdmin={false}
        onOptimisticReaction={onOptimisticReaction}
        comment={makeComment()}
      />
    );

    // Click the Like button text
    await user.click(screen.getByText("Like"));

    expect(onOptimisticReaction).toHaveBeenCalledWith(
      "comment-1",
      "like",
      null // previous reaction
    );
    expect(mockToggleCommentReaction).toHaveBeenCalledWith(
      "comment-1",
      "like"
    );
  });
});
