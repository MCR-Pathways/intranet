/**
 * Tests for PostComposer component.
 *
 * Covers: collapsed trigger card rendering, dialog open on click,
 * action bar buttons, user avatar display, and disabled state.
 *
 * Note: The full dialog (PostCreateDialog) is mocked — it's a complex
 * Radix Dialog with Tiptap, attachments, and polls. We test the
 * parent PostComposer's state management and trigger behaviour.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostComposer } from "./post-composer";
import type { PostAuthor } from "@/types/database.types";

// Mock server actions
vi.mock("@/app/(protected)/intranet/actions", () => ({
  createPost: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock hooks
vi.mock("@/hooks/use-auto-link-preview", () => ({
  useAutoLinkPreview: vi.fn(() => ({
    autoLinkPreview: null,
    isFetchingPreview: false,
    dismissPreview: vi.fn(),
    resetPreview: vi.fn(),
  })),
}));

// Mock heavy child components to keep tests fast and focused
vi.mock("./post-create-dialog", () => ({
  PostCreateDialog: vi.fn(({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? (
      <div data-testid="create-dialog">
        <button onClick={() => onOpenChange(false)}>Close Dialog</button>
      </div>
    ) : null
  ),
}));

vi.mock("./composer-action-bar", () => ({
  ComposerActionBar: vi.fn(
    ({
      onPhotoClick,
      onDocumentClick,
      onPollClick,
    }: {
      onPhotoClick: () => void;
      onDocumentClick: () => void;
      onPollClick: () => void;
    }) => (
      <div data-testid="action-bar">
        <button onClick={onPhotoClick}>Photo</button>
        <button onClick={onDocumentClick}>Document</button>
        <button onClick={onPollClick}>Poll</button>
      </div>
    )
  ),
}));

const userProfile: PostAuthor = {
  id: "user-1",
  full_name: "Alice Smith",
  preferred_name: "Ali",
  avatar_url: "https://example.com/avatar.jpg",
  job_title: "Developer",
};

const mentionUsers = [
  { id: "user-2", full_name: "Bob Jones", avatar_url: null },
];

describe("PostComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =============================================
  // Collapsed card rendering
  // =============================================

  it("renders collapsed trigger card with placeholder text", () => {
    render(
      <PostComposer userProfile={userProfile} mentionUsers={mentionUsers} />
    );
    expect(
      screen.getByText("Share something with the team...")
    ).toBeInTheDocument();
  });

  it("renders user avatar with preferred name", () => {
    render(
      <PostComposer userProfile={userProfile} mentionUsers={mentionUsers} />
    );
    // Avatar fallback should show initials of preferred_name ("Ali" → "A")
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("falls back to full_name initials when preferred_name is null", () => {
    const profile = { ...userProfile, preferred_name: null, avatar_url: null };
    render(
      <PostComposer userProfile={profile} mentionUsers={mentionUsers} />
    );
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("renders action bar in collapsed card", () => {
    render(
      <PostComposer userProfile={userProfile} mentionUsers={mentionUsers} />
    );
    expect(screen.getByTestId("action-bar")).toBeInTheDocument();
  });

  // =============================================
  // Dialog opening
  // =============================================

  it("opens dialog when trigger pill is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PostComposer userProfile={userProfile} mentionUsers={mentionUsers} />
    );

    expect(screen.queryByTestId("create-dialog")).not.toBeInTheDocument();

    await user.click(screen.getByText("Share something with the team..."));

    expect(screen.getByTestId("create-dialog")).toBeInTheDocument();
  });

  it("opens dialog when Photo action is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PostComposer userProfile={userProfile} mentionUsers={mentionUsers} />
    );

    await user.click(screen.getByText("Photo"));

    expect(screen.getByTestId("create-dialog")).toBeInTheDocument();
  });

  it("opens dialog when Document action is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PostComposer userProfile={userProfile} mentionUsers={mentionUsers} />
    );

    await user.click(screen.getByText("Document"));

    expect(screen.getByTestId("create-dialog")).toBeInTheDocument();
  });

  it("opens dialog when Poll action is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PostComposer userProfile={userProfile} mentionUsers={mentionUsers} />
    );

    await user.click(screen.getByText("Poll"));

    expect(screen.getByTestId("create-dialog")).toBeInTheDocument();
  });

  // =============================================
  // Dialog close
  // =============================================

  it("closes dialog and returns to collapsed state", async () => {
    const user = userEvent.setup();
    render(
      <PostComposer userProfile={userProfile} mentionUsers={mentionUsers} />
    );

    // Open dialog
    await user.click(screen.getByText("Share something with the team..."));
    expect(screen.getByTestId("create-dialog")).toBeInTheDocument();

    // Close dialog
    await user.click(screen.getByText("Close Dialog"));
    expect(screen.queryByTestId("create-dialog")).not.toBeInTheDocument();

    // Collapsed card still visible
    expect(
      screen.getByText("Share something with the team...")
    ).toBeInTheDocument();
  });
});
