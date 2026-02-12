"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Send } from "lucide-react";
import { addComment } from "@/app/(protected)/intranet/actions";
import { CommentItem } from "./comment-item";
import type {
  CommentWithAuthor,
  PostAuthor,
  ReactionType,
} from "@/types/database.types";

interface CommentSectionProps {
  postId: string;
  comments: CommentWithAuthor[];
  currentUserId: string;
  currentUserProfile: PostAuthor;
  isHRAdmin: boolean;
  expanded?: boolean;
  onToggleExpanded?: (expanded: boolean) => void;
  onOptimisticComment: (
    comment: CommentWithAuthor,
    parentId?: string
  ) => void;
  onOptimisticCommentReaction: (
    commentId: string,
    reactionType: ReactionType,
    currentUserReaction: ReactionType | null
  ) => void;
}

export function CommentSection({
  postId,
  comments,
  currentUserId,
  currentUserProfile,
  isHRAdmin,
  expanded: controlledExpanded,
  onToggleExpanded,
  onOptimisticComment,
  onOptimisticCommentReaction,
}: CommentSectionProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isPending, startTransition] = useTransition();

  // Use controlled state if provided, otherwise internal state
  const expanded = controlledExpanded ?? internalExpanded;
  const setExpanded = onToggleExpanded ?? setInternalExpanded;

  const displayName =
    currentUserProfile.preferred_name ||
    currentUserProfile.full_name ||
    "User";

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const buildOptimisticComment = (
    content: string,
    parentId?: string
  ): CommentWithAuthor => ({
    id: `optimistic-${crypto.randomUUID()}`,
    post_id: postId,
    author_id: currentUserId,
    content,
    parent_id: parentId ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author: {
      id: currentUserProfile.id,
      full_name: currentUserProfile.full_name,
      preferred_name: currentUserProfile.preferred_name,
      avatar_url: currentUserProfile.avatar_url,
    },
    reactions: [],
    reaction_counts: {
      like: 0,
      love: 0,
      celebrate: 0,
      insightful: 0,
      curious: 0,
    },
    user_reaction: null,
    replies: [],
  });

  const handleSubmit = () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;

    const optimistic = buildOptimisticComment(trimmed);
    setNewComment("");
    setExpanded(true);
    onOptimisticComment(optimistic);

    startTransition(async () => {
      await addComment(postId, trimmed);
    });
  };

  const handleReplySubmit = (parentId: string) => {
    const trimmed = replyContent.trim();
    if (!trimmed) return;

    const optimistic = buildOptimisticComment(trimmed, parentId);
    setReplyContent("");
    setReplyingTo(null);
    onOptimisticComment(optimistic, parentId);

    startTransition(async () => {
      await addComment(postId, trimmed, parentId);
    });
  };

  const getReplyToName = (commentId: string): string => {
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return "User";
    return (
      comment.author.preferred_name || comment.author.full_name || "User"
    );
  };

  return (
    <div>
      {/* Comment list */}
      {expanded && comments.length > 0 && (
        <div className="space-y-3 py-3">
          {comments.map((comment) => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                currentUserId={currentUserId}
                isHRAdmin={isHRAdmin}
                onReplyClick={() =>
                  setReplyingTo(
                    replyingTo === comment.id ? null : comment.id
                  )
                }
                onOptimisticReaction={onOptimisticCommentReaction}
              />

              {/* Replies — indented with left border */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-9 mt-2 space-y-2 border-l-2 border-muted pl-3">
                  {comment.replies.map((reply) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      currentUserId={currentUserId}
                      isHRAdmin={isHRAdmin}
                      isReply
                      onOptimisticReaction={onOptimisticCommentReaction}
                    />
                  ))}
                </div>
              )}

              {/* Inline reply input */}
              {replyingTo === comment.id && (
                <div className="ml-9 mt-2 flex gap-2">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage
                      src={currentUserProfile.avatar_url || undefined}
                      alt={displayName}
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 gap-1.5">
                    <input
                      type="text"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder={`Reply to ${getReplyToName(comment.id)}...`}
                      className="flex-1 rounded-full border border-input bg-muted/50 px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      maxLength={2000}
                      disabled={isPending}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleReplySubmit(comment.id);
                        }
                        if (e.key === "Escape") {
                          setReplyingTo(null);
                          setReplyContent("");
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleReplySubmit(comment.id)}
                      disabled={isPending || !replyContent.trim()}
                    >
                      {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add comment input */}
      <div className="flex gap-2 pt-2">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage
            src={currentUserProfile.avatar_url || undefined}
            alt={displayName}
          />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-1 gap-1.5">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 rounded-full border border-input bg-muted/50 px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            maxLength={2000}
            disabled={isPending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={handleSubmit}
            disabled={isPending || !newComment.trim()}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
