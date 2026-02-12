"use client";

import { useState, useRef, useCallback, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThumbsUp, MessageCircle } from "lucide-react";
import { toggleReaction } from "@/app/(protected)/intranet/actions";
import { REACTIONS, REACTION_COLORS } from "./reaction-constants";
import type { ReactionType } from "@/types/database.types";

interface ReactionBarProps {
  postId: string;
  reactionCounts: Record<ReactionType, number>;
  userReaction: ReactionType | null;
  commentCount: number;
  onCommentClick: () => void;
  onOptimisticReaction: (reactionType: ReactionType) => void;
}

export function ReactionBar({
  postId,
  reactionCounts,
  userReaction,
  commentCount,
  onCommentClick,
  onOptimisticReaction,
}: ReactionBarProps) {
  const [isPending, startTransition] = useTransition();
  const [showPicker, setShowPicker] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverAreaRef = useRef<HTMLDivElement>(null);

  const totalReactions = Object.values(reactionCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  const activeReactions = REACTIONS.filter(
    (r) => reactionCounts[r.type] > 0
  );

  const currentReaction = userReaction
    ? REACTIONS.find((r) => r.type === userReaction)
    : null;

  const handleReaction = useCallback(
    (type: ReactionType) => {
      setShowPicker(false);
      onOptimisticReaction(type);
      startTransition(async () => {
        await toggleReaction(postId, type);
      });
    },
    [postId, onOptimisticReaction]
  );

  const handleLikeClick = useCallback(() => {
    // Simple click toggles like (or removes current reaction)
    if (userReaction) {
      handleReaction(userReaction); // removes it
    } else {
      handleReaction("like"); // default to like
    }
  }, [userReaction, handleReaction]);

  // Desktop: hover to show picker with delay on leave
  const handleMouseEnter = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setShowPicker(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => {
      setShowPicker(false);
    }, 300);
  }, []);

  // Mobile: long press to show picker
  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setShowPicker(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
      }
    };
  }, []);

  const hasSummary = totalReactions > 0 || commentCount > 0;

  return (
    <div className="space-y-1">
      {/* Reaction summary + comment count */}
      {hasSummary && (
        <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
          {totalReactions > 0 ? (
            <div className="flex items-center gap-1">
              <span className="flex -space-x-0.5">
                {activeReactions.map((r) => (
                  <span
                    key={r.type}
                    className="text-base leading-none"
                    title={`${r.label}: ${reactionCounts[r.type]}`}
                  >
                    {r.emoji}
                  </span>
                ))}
              </span>
              <span className="ml-1 text-xs">{totalReactions}</span>
            </div>
          ) : (
            <span />
          )}
          {commentCount > 0 && (
            <button
              type="button"
              className="text-xs hover:underline cursor-pointer"
              onClick={onCommentClick}
            >
              {commentCount} {commentCount === 1 ? "comment" : "comments"}
            </button>
          )}
        </div>
      )}

      {/* Action bar: Like + Comment */}
      <div className="flex items-center border-t border-b border-border py-0.5">
        {/* Like button area with hover picker */}
        <div
          ref={hoverAreaRef}
          className="relative flex-1"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Reaction picker (floating) — pb-2 keeps padding inside hover target */}
          {showPicker && (
            <div className="absolute bottom-full left-0 pb-2 z-50">
              <div className="flex items-center gap-1 rounded-full bg-card border border-border shadow-lg px-2 py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {REACTIONS.map((reaction) => (
                  <button
                    key={reaction.type}
                    type="button"
                    className={cn(
                      "text-2xl leading-none cursor-pointer transition-transform duration-150 hover:scale-125 p-1 rounded-full",
                      userReaction === reaction.type && "bg-muted"
                    )}
                    title={reaction.label}
                    onClick={() => handleReaction(reaction.type)}
                    disabled={isPending}
                  >
                    {reaction.emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Like/reaction button */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full gap-2 text-sm font-medium",
              currentReaction
                ? REACTION_COLORS[currentReaction.type]
                : "text-muted-foreground"
            )}
            onClick={handleLikeClick}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            disabled={isPending}
          >
            {currentReaction ? (
              <span className="text-lg leading-none">
                {currentReaction.emoji}
              </span>
            ) : (
              <ThumbsUp className="h-4 w-4" />
            )}
            {currentReaction ? currentReaction.label : "Like"}
          </Button>
        </div>

        {/* Comment button */}
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 gap-2 text-sm font-medium text-muted-foreground"
          onClick={onCommentClick}
        >
          <MessageCircle className="h-4 w-4" />
          Comment
        </Button>
      </div>
    </div>
  );
}
