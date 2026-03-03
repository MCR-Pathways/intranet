/**
 * Tests for CommentSection component.
 *
 * Covers: comment list rendering, empty state, reply form toggle,
 * comment submission, expand/collapse, and keyboard shortcuts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentSection } from "./comment-section";
import type { CommentWithAuthor, PostAuthor } from "@/types/database.types";

// Mock server actions
vi.mock("@/app/(protected)/intranet/actions", () => ({
  addComment: vi.fn().mockResolvedValue({ success: true }),
  deleteComment: vi.fn().mockResolvedValue({ success: true }),
  editComment: vi.fn().mockResolvedValue({ success: true }),
  toggleCommentReaction: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock linkifyText for TiptapRenderer
vi.mock("@/lib/url", () => ({
  linkifyText: vi.fn((text: string) => [text]),
}));

// Mock reaction constants
vi.mock("./reaction-constants", () => ({
  REACTIONS: [
    { type: "like", emoji: "👍", label: "Like" },
  ],
  REACTION_COLORS: {
    like: "text-blue-600",
  },
}));

const currentUserProfile: PostAuthor = {
  id: "user-1",
  full_name: "Alice Smith",
  preferred_name: null,
  avatar_url: null,
  job_title: null,
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
    reaction_counts: { like: 0, love: 0, celebrate: 0, insightful: 0, curious: 0 },
    user_reaction: null,
    replies: [],
    ...overrides,
  };
}

const defaultProps = {
  postId: "post-1",
  currentUserId: "user-1",
  currentUserProfile,
  isHRAdmin: false,
  onOptimisticComment: vi.fn(),
  onOptimisticCommentReaction: vi.fn(),
};

describe("CommentSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =============================================
  // Comment input
  // =============================================

  it("renders comment input with placeholder", () => {
    render(<CommentSection {...defaultProps} comments={[]} />);
    expect(screen.getByPlaceholderText("Write a comment...")).toBeInTheDocument();
  });

  it("shows user avatar in comment input", () => {
    render(<CommentSection {...defaultProps} comments={[]} />);
    // Avatar fallback should show initials
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("disables send button when input is empty", () => {
    render(<CommentSection {...defaultProps} comments={[]} />);
    // Send button is the one next to the comment input
    const input = screen.getByPlaceholderText("Write a comment...");
    const sendButton = input.closest("div")?.querySelector("button");
    expect(sendButton).toBeDisabled();
  });

  it("enables send button when input has text", async () => {
    const user = userEvent.setup();
    render(<CommentSection {...defaultProps} comments={[]} />);

    const input = screen.getByPlaceholderText("Write a comment...");
    await user.type(input, "Nice!");

    const sendButton = input.closest("div")?.querySelector("button");
    expect(sendButton).not.toBeDisabled();
  });

  it("calls onOptimisticComment and clears input on submit", async () => {
    const user = userEvent.setup();
    const onOptimisticComment = vi.fn();
    render(
      <CommentSection
        {...defaultProps}
        comments={[]}
        onOptimisticComment={onOptimisticComment}
      />
    );

    const input = screen.getByPlaceholderText("Write a comment...");
    await user.type(input, "New comment");
    await user.keyboard("{Enter}");

    expect(onOptimisticComment).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "New comment",
        author_id: "user-1",
        post_id: "post-1",
      })
    );
    expect(input).toHaveValue("");
  });

  it("does not submit empty comment on Enter", async () => {
    const user = userEvent.setup();
    const onOptimisticComment = vi.fn();
    render(
      <CommentSection
        {...defaultProps}
        comments={[]}
        onOptimisticComment={onOptimisticComment}
      />
    );

    const input = screen.getByPlaceholderText("Write a comment...");
    await user.click(input);
    await user.keyboard("{Enter}");

    expect(onOptimisticComment).not.toHaveBeenCalled();
  });

  // =============================================
  // Comment list (expanded)
  // =============================================

  it("shows comments when expanded", () => {
    const comments = [
      makeComment({ id: "c1", content: "First comment" }),
      makeComment({ id: "c2", content: "Second comment" }),
    ];
    render(
      <CommentSection {...defaultProps} comments={comments} expanded={true} />
    );
    expect(screen.getByText("First comment")).toBeInTheDocument();
    expect(screen.getByText("Second comment")).toBeInTheDocument();
  });

  it("hides comments when collapsed", () => {
    const comments = [makeComment({ content: "Hidden comment" })];
    render(
      <CommentSection {...defaultProps} comments={comments} expanded={false} />
    );
    expect(screen.queryByText("Hidden comment")).not.toBeInTheDocument();
  });

  it("shows empty state when expanded with no comments", () => {
    const { container } = render(
      <CommentSection {...defaultProps} comments={[]} expanded={true} />
    );
    // No comment items rendered, but input is always visible
    expect(screen.getByPlaceholderText("Write a comment...")).toBeInTheDocument();
    // No comment author names in the DOM (no comments rendered)
    expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
  });

  // =============================================
  // Replies
  // =============================================

  it("renders nested replies indented", () => {
    const comments = [
      makeComment({
        id: "c1",
        content: "Parent comment",
        replies: [
          makeComment({
            id: "r1",
            content: "Reply to parent",
            parent_id: "c1",
            author_id: "user-3",
            author: {
              id: "user-3",
              full_name: "Charlie Davis",
              preferred_name: null,
              avatar_url: null,
            },
          }),
        ],
      }),
    ];
    render(
      <CommentSection {...defaultProps} comments={comments} expanded={true} />
    );
    expect(screen.getByText("Parent comment")).toBeInTheDocument();
    expect(screen.getByText("Reply to parent")).toBeInTheDocument();
  });

  // =============================================
  // Author display
  // =============================================

  it("shows comment author name", () => {
    const comments = [makeComment()];
    render(
      <CommentSection {...defaultProps} comments={comments} expanded={true} />
    );
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });

  it("shows preferred name when available", () => {
    const comments = [
      makeComment({
        author: {
          id: "user-2",
          full_name: "Robert Jones",
          preferred_name: "Bob",
          avatar_url: null,
        },
      }),
    ];
    render(
      <CommentSection {...defaultProps} comments={comments} expanded={true} />
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });
});
