"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Clock, Loader2, BarChart3 } from "lucide-react";
import { votePoll, removeVote } from "@/app/(protected)/intranet/actions";
import type { PostPoll } from "@/types/database.types";

interface PollDisplayProps {
  postId: string;
  poll: PostPoll;
}

export function PollDisplay({ postId, poll }: PollDisplayProps) {
  // Single-select state
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  // Multi-select state
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

  // Sort options by display_order
  const sortedOptions = useMemo(
    () => [...poll.options].sort((a, b) => a.display_order - b.display_order),
    [poll.options]
  );

  const hasSelection = poll.allow_multiple
    ? selectedOptionIds.size > 0
    : selectedOptionId !== null;

  const voteLabel = poll.allow_multiple ? "voter" : "vote";
  const voteLabelPlural = poll.allow_multiple ? "voters" : "votes";

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      {/* Question */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-sm font-medium">{poll.question}</p>
      </div>

      {/* Multi-select hint */}
      {poll.allow_multiple && !showResults && (
        <p className="text-xs text-muted-foreground -mt-1">Select all that apply</p>
      )}

      {/* Options */}
      <div className="space-y-2">
        {sortedOptions.map((option) => {
          const percentage =
            poll.total_votes > 0
              ? Math.round((option.vote_count / poll.total_votes) * 100)
              : 0;
          const isUserVote = votedOptionIds.has(option.id);

          if (showResults) {
            // Results view — horizontal bars
            return (
              <div key={option.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className={cn("flex items-center gap-1.5", isUserVote && "font-medium")}>
                    {isUserVote && <Check className="h-3.5 w-3.5 text-primary" />}
                    {option.option_text}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{percentage}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-primary/10">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isUserVote ? "bg-primary" : "bg-primary/40"
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                {poll.allow_multiple && (
                  <p className="text-xs text-muted-foreground">
                    {option.vote_count} of {poll.total_votes} {voteLabelPlural}
                  </p>
                )}
              </div>
            );
          }

          // Voting view
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
                "flex w-full items-center rounded-lg border px-3 py-2 text-sm transition-colors text-left",
                isSelected
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-background hover:border-primary/50 hover:bg-primary/5"
              )}
            >
              {/* Indicator: checkbox for multi-select, radio for single */}
              <div
                className={cn(
                  "mr-3 h-4 w-4 shrink-0 border-2 transition-colors flex items-center justify-center",
                  poll.allow_multiple ? "rounded-sm" : "rounded-full",
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
                )}
              >
                {isSelected && (
                  poll.allow_multiple
                    ? <Check className="h-3 w-3 text-white" />
                    : <div className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </div>
              {option.option_text}
            </button>
          );
        })}
      </div>

      {/* Vote button (when not yet voted and poll is open) */}
      {!showResults && !poll.is_closed && (
        <Button
          size="sm"
          onClick={handleVote}
          disabled={!hasSelection || isPending}
        >
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

      {/* Footer: total votes + time remaining + change vote */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>
            {poll.total_votes} {poll.total_votes === 1 ? voteLabel : voteLabelPlural}
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
            className="text-primary hover:underline disabled:opacity-50"
          >
            {poll.allow_multiple ? "Change selections" : "Change vote"}
          </button>
        )}
      </div>
    </div>
  );
}
