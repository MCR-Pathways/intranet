/**
 * Tests for PollDisplay component.
 *
 * Covers: voting view vs results view, expired polls, percentage calculation,
 * zero votes, vote button state, change vote, and time remaining display.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PollDisplay } from "./poll-display";
import type { PostPoll, PostPollOption } from "@/types/database.types";

// Mock server actions
vi.mock("@/app/(protected)/intranet/actions", () => ({
  votePoll: vi.fn(),
  removeVote: vi.fn(),
}));

function makeOption(overrides: Partial<PostPollOption> & { id: string }): PostPollOption {
  return {
    option_text: "Option",
    display_order: 0,
    vote_count: 0,
    ...overrides,
  };
}

function makePoll(overrides?: Partial<PostPoll>): PostPoll {
  return {
    question: "What's your favourite colour?",
    options: [
      makeOption({ id: "opt-1", option_text: "Red", display_order: 1, vote_count: 3 }),
      makeOption({ id: "opt-2", option_text: "Blue", display_order: 2, vote_count: 7 }),
    ],
    total_votes: 10,
    user_vote_option_id: null,
    user_vote_option_ids: [],
    closes_at: null,
    is_closed: false,
    allow_multiple: false,
    ...overrides,
  };
}

describe("PollDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =============================================
  // Voting view (user hasn't voted, poll open)
  // =============================================

  it("renders poll question", () => {
    render(<PollDisplay postId="p1" poll={makePoll()} />);
    expect(screen.getByText("What's your favourite colour?")).toBeInTheDocument();
  });

  it("renders option buttons when user hasn't voted", () => {
    render(<PollDisplay postId="p1" poll={makePoll()} />);
    expect(screen.getByText("Red")).toBeInTheDocument();
    expect(screen.getByText("Blue")).toBeInTheDocument();
    // Should show Vote button
    expect(screen.getByText("Vote")).toBeInTheDocument();
  });

  it("shows total votes count", () => {
    render(<PollDisplay postId="p1" poll={makePoll()} />);
    expect(screen.getByText("10 votes")).toBeInTheDocument();
  });

  it("shows singular 'vote' for 1 total vote", () => {
    render(<PollDisplay postId="p1" poll={makePoll({ total_votes: 1 })} />);
    expect(screen.getByText("1 vote")).toBeInTheDocument();
  });

  it("disables Vote button when no option selected", () => {
    render(<PollDisplay postId="p1" poll={makePoll()} />);
    const voteButton = screen.getByText("Vote").closest("button");
    expect(voteButton).toBeDisabled();
  });

  it("enables Vote button after selecting an option", async () => {
    const user = userEvent.setup();
    render(<PollDisplay postId="p1" poll={makePoll()} />);

    await user.click(screen.getByText("Red"));

    const voteButton = screen.getByText("Vote").closest("button");
    expect(voteButton).not.toBeDisabled();
  });

  // =============================================
  // Results view (user has voted)
  // =============================================

  it("shows results with percentages when user has voted", () => {
    const poll = makePoll({ user_vote_option_id: "opt-1", user_vote_option_ids: ["opt-1"] });
    render(<PollDisplay postId="p1" poll={poll} />);

    // Should show percentages, not vote buttons
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
    // Vote button should not be present
    expect(screen.queryByText("Vote")).not.toBeInTheDocument();
  });

  it("shows 'Change vote' button when user has voted and poll is open", () => {
    const poll = makePoll({ user_vote_option_id: "opt-1", user_vote_option_ids: ["opt-1"] });
    render(<PollDisplay postId="p1" poll={poll} />);
    expect(screen.getByText("Change vote")).toBeInTheDocument();
  });

  it("hides 'Change vote' when poll is closed", () => {
    const poll = makePoll({ user_vote_option_id: "opt-1", user_vote_option_ids: ["opt-1"], is_closed: true });
    render(<PollDisplay postId="p1" poll={poll} />);
    expect(screen.queryByText("Change vote")).not.toBeInTheDocument();
  });

  // =============================================
  // Closed / expired polls
  // =============================================

  it("shows results when poll is closed even if user hasn't voted", () => {
    const poll = makePoll({ is_closed: true });
    render(<PollDisplay postId="p1" poll={poll} />);

    // Percentages should be visible (results view forced by is_closed)
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
  });

  it("does not show Vote button when poll is closed", () => {
    const poll = makePoll({ is_closed: true });
    render(<PollDisplay postId="p1" poll={poll} />);
    expect(screen.queryByText("Vote")).not.toBeInTheDocument();
  });

  // =============================================
  // Percentage calculation edge cases
  // =============================================

  it("shows 0% for all options when total_votes is 0", () => {
    const poll = makePoll({
      options: [
        makeOption({ id: "opt-1", option_text: "A", display_order: 1 }),
        makeOption({ id: "opt-2", option_text: "B", display_order: 2 }),
      ],
      total_votes: 0,
      is_closed: true, // Force results view
    });
    render(<PollDisplay postId="p1" poll={poll} />);

    const percentages = screen.getAllByText("0%");
    expect(percentages).toHaveLength(2);
  });

  it("shows 0 votes for zero-vote poll", () => {
    const poll = makePoll({ total_votes: 0 });
    render(<PollDisplay postId="p1" poll={poll} />);
    expect(screen.getByText("0 votes")).toBeInTheDocument();
  });

  // =============================================
  // Time remaining
  // =============================================

  it("shows time remaining when closes_at is in the future", () => {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
    const poll = makePoll({ closes_at: futureDate.toISOString() });
    render(<PollDisplay postId="p1" poll={poll} />);

    // Should show something like "2d Xh remaining"
    expect(screen.getByText(/\d+d \d+h remaining/)).toBeInTheDocument();
  });

  it("shows 'Closed' when closes_at is in the past", () => {
    const pastDate = new Date(Date.now() - 60 * 1000);
    const poll = makePoll({ closes_at: pastDate.toISOString() });
    render(<PollDisplay postId="p1" poll={poll} />);
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("does not show time remaining when closes_at is null", () => {
    const poll = makePoll({ closes_at: null });
    render(<PollDisplay postId="p1" poll={poll} />);
    expect(screen.queryByText(/remaining/)).not.toBeInTheDocument();
    expect(screen.queryByText("Closed")).not.toBeInTheDocument();
  });

  // =============================================
  // Option ordering
  // =============================================

  it("sorts options by display_order", () => {
    const poll = makePoll({
      options: [
        makeOption({ id: "opt-2", option_text: "Second", display_order: 2 }),
        makeOption({ id: "opt-1", option_text: "First", display_order: 1 }),
      ],
    });
    render(<PollDisplay postId="p1" poll={poll} />);

    const firstButton = screen.getByRole("button", { name: "First" });
    const secondButton = screen.getByRole("button", { name: "Second" });

    // Verify First appears before Second in the DOM
    const position = firstButton.compareDocumentPosition(secondButton);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
