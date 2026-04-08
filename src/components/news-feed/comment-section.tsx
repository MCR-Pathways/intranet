"use client";

import { useState, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Send } from "lucide-react";
import { cn, getInitials, getAvatarColour, filterAvatarUrl } from "@/lib/utils";
import { addComment } from "@/app/(protected)/intranet/actions";
import { CommentItem } from "./comment-item";
import { TiptapComposer } from "./tiptap-composer";
import type { MentionUser } from "./mention-list";
import type { TiptapDocument } from "@/lib/tiptap";
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
  /** Users available for @mentions in comments */
  mentionUsers?: MentionUser[];
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
  mentionUsers,
  expanded: controlledExpanded,
  onToggleExpanded,
  onOptimisticComment,
  onOptimisticCommentReaction,
}: CommentSectionProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [newCommentJson, setNewCommentJson] = useState<TiptapDocument | null>(null);
  const [commentResetKey, setCommentResetKey] = useState(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyContentJson, setReplyContentJson] = useState<TiptapDocument | null>(null);
  const [replyResetKey, setReplyResetKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  // Use controlled state if provided, otherwise internal state
  const expanded = controlledExpanded ?? internalExpanded;
  const setExpanded = onToggleExpanded ?? setInternalExpanded;

  const displayName =
    currentUserProfile.preferred_name ||
    currentUserProfile.full_name ||
    "User";

  const buildOptimisticComment = (
    content: string,
    parentId?: string,
    contentJson?: TiptapDocument | null
  ): CommentWithAuthor => ({
    id: `optimistic-${crypto.randomUUID()}`,
    post_id: postId,
    author_id: currentUserId,
    content,
    content_json: (contentJson as Record<string, unknown>) ?? null,
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

  const handleCommentChange = useCallback((json: TiptapDocument, text: string) => {
    setNewCommentJson(json);
    setNewComment(text);
  }, []);

  const handleReplyChange = useCallback((json: TiptapDocument, text: string) => {
    setReplyContentJson(json);
    setReplyContent(text);
  }, []);

  const handleSubmit = () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;

    const json = newCommentJson;
    const optimistic = buildOptimisticComment(trimmed, undefined, json);
    setNewComment("");
    setNewCommentJson(null);
    setCommentResetKey((k) => k + 1);
    setExpanded(true);
    onOptimisticComment(optimistic);

    startTransition(async () => {
      // Serialise to plain object to avoid React server component reference issues
      const safeJson = json ? JSON.parse(JSON.stringify(json)) : undefined;
      await addComment(postId, trimmed, undefined, safeJson);
    });
  };

  const handleReplySubmit = (parentId: string) => {
    const trimmed = replyContent.trim();
    if (!trimmed) return;

    const json = replyContentJson;
    const optimistic = buildOptimisticComment(trimmed, parentId, json);
    setReplyContent("");
    setReplyContentJson(null);
    setReplyResetKey((k) => k + 1);
    setReplyingTo(null);
    onOptimisticComment(optimistic, parentId);

    startTransition(async () => {
      const safeJson = json ? JSON.parse(JSON.stringify(json)) : undefined;
      await addComment(postId, trimmed, parentId, safeJson);
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
                      src={filterAvatarUrl(currentUserProfile.avatar_url)}
                      alt={displayName}
                    />
                    <AvatarFallback className={cn(getAvatarColour(displayName).bg, getAvatarColour(displayName).fg, "text-[10px]")}>
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 gap-1.5">
                    <div className="flex-1">
                      <TiptapComposer
                        mentionUsers={mentionUsers ?? []}
                        placeholder={`Reply to ${getReplyToName(comment.id)}...`}
                        onChange={handleReplyChange}
                        onSubmit={() => handleReplySubmit(comment.id)}
                        maxLength={2000}
                        disabled={isPending}
                        resetKey={replyResetKey}
                        minimal
                        autoFocus
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 self-end"
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
            src={filterAvatarUrl(currentUserProfile.avatar_url)}
            alt={displayName}
          />
          <AvatarFallback className={cn(getAvatarColour(displayName).bg, getAvatarColour(displayName).fg, "text-xs")}>
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-1 gap-1.5">
          <div className="flex-1">
            <TiptapComposer
              mentionUsers={mentionUsers ?? []}
              placeholder="Write a comment..."
              onChange={handleCommentChange}
              onSubmit={handleSubmit}
              maxLength={2000}
              disabled={isPending}
              resetKey={commentResetKey}
              minimal
            />
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 self-end"
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
