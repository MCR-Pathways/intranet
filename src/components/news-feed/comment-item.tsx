"use client";

import { useState, useRef, useCallback, useEffect, useTransition } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn, timeAgo } from "@/lib/utils";
import { linkifyText } from "@/lib/url";
import { Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteComment, toggleCommentReaction } from "@/app/(protected)/intranet/actions";
import { REACTIONS, REACTION_COLORS } from "./reaction-constants";
import type { CommentWithAuthor, ReactionType } from "@/types/database.types";

interface CommentItemProps {
  comment: CommentWithAuthor;
  currentUserId: string;
  isHRAdmin: boolean;
  onReplyClick?: () => void;
  isReply?: boolean;
  onOptimisticReaction: (
    commentId: string,
    reactionType: ReactionType,
    currentUserReaction: ReactionType | null
  ) => void;
}

export function CommentItem({
  comment,
  currentUserId,
  isHRAdmin,
  onReplyClick,
  isReply = false,
  onOptimisticReaction,
}: CommentItemProps) {
  const [isPending, startTransition] = useTransition();
  const [showPicker, setShowPicker] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canDelete =
    comment.author_id === currentUserId || isHRAdmin;

  const displayName =
    comment.author.preferred_name || comment.author.full_name || "User";

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const handleDelete = () => {
    startTransition(async () => {
      await deleteComment(comment.id);
      setShowDeleteDialog(false);
    });
  };

  const handleReaction = useCallback(
    (type: ReactionType) => {
      setShowPicker(false);
      onOptimisticReaction(comment.id, type, comment.user_reaction);
      startTransition(async () => {
        await toggleCommentReaction(comment.id, type);
      });
    },
    [comment.id, comment.user_reaction, onOptimisticReaction]
  );

  const handleLikeClick = useCallback(() => {
    if (comment.user_reaction) {
      handleReaction(comment.user_reaction); // removes it
    } else {
      handleReaction("like"); // default to like
    }
  }, [comment.user_reaction, handleReaction]);

  // Hover handlers with delay
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

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
      }
    };
  }, []);

  const currentReaction = comment.user_reaction
    ? REACTIONS.find((r) => r.type === comment.user_reaction)
    : null;

  const totalReactions = Object.values(comment.reaction_counts).reduce(
    (sum, count) => sum + count,
    0
  );

  const activeReactions = REACTIONS.filter(
    (r) => comment.reaction_counts[r.type] > 0
  );

  const avatarSize = isReply ? "h-6 w-6" : "h-7 w-7";

  return (
    <div className="flex gap-2 group">
      <Avatar className={cn(avatarSize, "shrink-0")}>
        <AvatarImage
          src={comment.author.avatar_url || undefined}
          alt={displayName}
        />
        <AvatarFallback className="bg-muted text-xs">
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="relative inline-block">
          <div className="rounded-2xl bg-muted/50 px-3 py-2">
            <p className="text-[13px] font-semibold leading-tight">{displayName}</p>
            <p className="text-sm font-normal whitespace-pre-wrap break-words">
              {linkifyText(comment.content)}
            </p>
          </div>

          {/* Reaction summary badge (bottom-right of bubble) */}
          {totalReactions > 0 && (
            <div className="absolute -bottom-2.5 right-1 flex items-center gap-0.5 bg-card border border-border rounded-full px-1.5 py-0.5 shadow-sm">
              <span className="flex -space-x-0.5">
                {activeReactions.map((r) => (
                  <span key={r.type} className="text-xs leading-none">
                    {r.emoji}
                  </span>
                ))}
              </span>
              {totalReactions > 1 && (
                <span className="text-[10px] text-muted-foreground ml-0.5">{totalReactions}</span>
              )}
            </div>
          )}
        </div>

        {/* Footer: time, Like, Reply, Delete */}
        <div className="flex items-center gap-3 mt-1 px-1">
          <span className="text-xs text-muted-foreground">
            {timeAgo(comment.created_at)}
          </span>

          {/* Like link with hover picker */}
          <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Mini reaction picker */}
            {showPicker && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-1 z-50">
                <div className="flex items-center gap-0.5 rounded-full bg-card border border-border shadow-lg px-1.5 py-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  {REACTIONS.map((reaction) => (
                    <button
                      key={reaction.type}
                      type="button"
                      className={cn(
                        "text-lg leading-none cursor-pointer transition-transform duration-150 hover:scale-125 p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full",
                        comment.user_reaction === reaction.type && "bg-muted"
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

            <button
              type="button"
              className={cn(
                "text-xs font-semibold cursor-pointer hover:underline",
                currentReaction
                  ? REACTION_COLORS[currentReaction.type]
                  : "text-muted-foreground"
              )}
              onClick={handleLikeClick}
              disabled={isPending}
            >
              {currentReaction ? currentReaction.label : "Like"}
            </button>
          </div>

          {/* Reply link — only on top-level comments */}
          {!isReply && onReplyClick && (
            <button
              type="button"
              className="text-xs font-semibold text-muted-foreground cursor-pointer hover:underline"
              onClick={onReplyClick}
            >
              Reply
            </button>
          )}

          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isPending}
            >
              <Trash2 className="h-3 w-3 mr-0.5" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {isReply ? "Reply" : "Comment"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {isReply ? "reply" : "comment"}? This action cannot be undone.
              {!isReply && comment.replies.length > 0 && (
                <> All replies will also be removed.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </AlertDialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
