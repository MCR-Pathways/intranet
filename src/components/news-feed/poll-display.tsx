"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Clock, Loader2 } from "lucide-react";
import { votePoll, removeVote } from "@/app/(protected)/intranet/actions";
import type { PostPoll } from "@/types/database.types";

interface PollDisplayProps {
  postId: string;
  poll: PostPoll;
}

// Honest two-shade result fills (design-system §8.3): the front-runner(s) take
// the dark lead fill, every other option shares the flat light fill. The bar
// width still encodes each option's exact share — only the shade is binary.
const LEAD_FILL = "bg-mcr-light-blue-200";
const TRAIL_FILL = "bg-mcr-light-blue-50";

export function PollDisplay({ postId, poll }: PollDisplayProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const hasVoted = poll.user_vote_option_ids.length > 0;
  const showResults = hasVoted || poll.is_closed;
  const votedOptionIds = useMemo(() => new Set(poll.user_vote_option_ids), [poll.user_vote_option_ids]);

  const timeRemaining = useMemo(() => {
    if (!poll.closes_at) return null;
    const closes = new Date(poll.closes_at);
    const now = new Date();
    const diff = closes.getTime() - now.getTime();
    if (diff <= 0) return "Closed";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h remaining`;
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes}m remaining`;
  }, [poll.closes_at]);

  const handleVote = useCallback(() => {
    if (isPending) return;

    const ids = poll.allow_multiple
      ? Array.from(selectedOptionIds)
      : selectedOptionId ? [selectedOptionId] : [];

    if (ids.length === 0) return;

    startTransition(async () => {
      await votePoll(postId, ids);
      setSelectedOptionId(null);
      setSelectedOptionIds(new Set());
    });
  }, [postId, selectedOptionId, selectedOptionIds, isPending, poll.allow_multiple]);

  const handleChangeVote = useCallback(() => {
    if (isPending) return;
    startTransition(async () => {
      await removeVote(postId);
    });
  }, [postId, isPending]);

  const toggleMultiOption = useCallback((optionId: string) => {
    setSelectedOptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }
      return next;
    });
  }, []);

  // Rows always render in the author's display order; lead shading is computed
  // separately from the vote counts (see leadIds).
  const sortedOptions = useMemo(
    () => [...poll.options].sort((a, b) => a.display_order - b.display_order),
    [poll.options]
  );
  // The front-runner(s): the option(s) with the most votes, but only when at
  // least one other option trails them. An all-square poll (including no votes
  // yet) has no front-runner, so nothing is emphasised.
  const leadIds = useMemo(() => {
    const maxVotes = Math.max(0, ...poll.options.map((o) => o.vote_count));
    const hasTrailer = poll.options.some((o) => o.vote_count < maxVotes);
    if (maxVotes === 0 || !hasTrailer) return new Set<string>();
    return new Set(
      poll.options.filter((o) => o.vote_count === maxVotes).map((o) => o.id)
    );
  }, [poll.options]);

  const hasSelection = poll.allow_multiple
    ? selectedOptionIds.size > 0
    : selectedOptionId !== null;

  const voteLabel = poll.allow_multiple ? "voter" : "vote";
  const voteLabelPlural = poll.allow_multiple ? "voters" : "votes";
  const totalLabel = `${poll.total_votes} ${poll.total_votes === 1 ? voteLabel : voteLabelPlural}`;

  return (
    <div className="space-y-3">
      {/* Question — the chart icon lives on the "Poll" pill in the header. */}
      <p className="text-base font-semibold tracking-[-0.01em]">{poll.question}</p>

      {poll.allow_multiple && !showResults && (
        <p className="-mt-1 text-xs text-muted-foreground">Select all that apply</p>
      )}

      <div className="space-y-2">
        {sortedOptions.map((option) => {
          const percentage =
            poll.total_votes > 0
              ? Math.round((option.vote_count / poll.total_votes) * 100)
              : 0;
          const isUserVote = votedOptionIds.has(option.id);

          if (showResults) {
            const isLead = leadIds.has(option.id);
            return (
              <div
                key={option.id}
                className="relative overflow-hidden rounded-[9px] border border-border bg-card"
              >
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 transition-[width] duration-500",
                    isLead ? LEAD_FILL : TRAIL_FILL
                  )}
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative flex items-center gap-1.5 px-3 py-2 text-[13.5px]">
                  {isUserVote && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-mcr-light-blue-700" strokeWidth={2.6} />
                  )}
                  <span
                    className={cn(
                      "truncate",
                      isLead ? "font-semibold text-mcr-light-blue-700" : "text-foreground"
                    )}
                    title={option.option_text}
                  >
                    {option.option_text}
                  </span>
                  <span
                    className={cn(
                      "ml-auto shrink-0 tabular-nums",
                      isLead ? "font-semibold text-mcr-light-blue-700" : "text-muted-foreground"
                    )}
                  >
                    {percentage}%
                  </span>
                </div>
              </div>
            );
          }

          const isSelected = poll.allow_multiple
            ? selectedOptionIds.has(option.id)
            : selectedOptionId === option.id;

          return (
            <button
              key={option.id}
              type="button"
              disabled={isPending || poll.is_closed}
              onClick={() => {
                if (poll.allow_multiple) {
                  toggleMultiOption(option.id);
                } else {
                  setSelectedOptionId(option.id);
                }
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-[9px] border px-3 py-2 text-left text-[13.5px] transition-colors",
                isSelected
                  ? "border-mcr-light-blue bg-mcr-light-blue-50"
                  : "border-border bg-card hover:border-mcr-light-blue/60 hover:bg-mcr-light-blue-50/50"
              )}
            >
              {/* checkbox for multi-select, radio for single */}
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center border-[1.5px] transition-colors",
                  poll.allow_multiple ? "rounded-sm" : "rounded-full",
                  isSelected ? "border-icon-fg-light-blue bg-icon-fg-light-blue" : "border-muted-foreground/40"
                )}
              >
                {isSelected &&
                  (poll.allow_multiple ? (
                    <Check className="h-3 w-3 text-white" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  ))}
              </span>
              {option.option_text}
            </button>
          );
        })}
      </div>

      {!showResults && !poll.is_closed && (
        <Button size="sm" onClick={handleVote} disabled={!hasSelection || isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Voting...
            </>
          ) : (
            "Vote"
          )}
        </Button>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span>
            {showResults ? totalLabel : `${totalLabel} so far · results appear after you vote`}
          </span>
          {timeRemaining && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeRemaining}
            </span>
          )}
        </div>
        {hasVoted && !poll.is_closed && (
          <button
            type="button"
            onClick={handleChangeVote}
            disabled={isPending}
            className="font-medium text-icon-fg-light-blue hover:underline disabled:opacity-50"
          >
            {poll.allow_multiple ? "Change selections" : "Change vote"}
          </button>
        )}
      </div>
    </div>
  );
}
