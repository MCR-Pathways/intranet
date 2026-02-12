"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Pin, Sparkles } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { AttachmentDisplay } from "./attachment-display";
import { ReactionBar } from "./reaction-bar";
import { CommentSection } from "./comment-section";
import { PostEditDialog } from "./post-edit-dialog";
import { PostDeleteDialog } from "./post-delete-dialog";
import type {
  PostWithRelations,
  PostAuthor,
  CommentWithAuthor,
  ReactionType,
} from "@/types/database.types";

interface PostCardProps {
  post: PostWithRelations;
  currentUserId: string;
  currentUserProfile: PostAuthor;
  isStaff: boolean;
  isHRAdmin: boolean;
}

export function PostCard({
  post,
  currentUserId,
  currentUserProfile,
  isStaff,
  isHRAdmin,
}: PostCardProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(false);

  // ─── Optimistic state ──────────────────────────────────────────────
  const [optimisticReactionCounts, setOptimisticReactionCounts] = useState(
    post.reaction_counts
  );
  const [optimisticUserReaction, setOptimisticUserReaction] = useState(
    post.user_reaction
  );
  const [optimisticComments, setOptimisticComments] = useState(post.comments);
  const [optimisticCommentCount, setOptimisticCommentCount] = useState(
    post.comment_count
  );

  // Stable key derived from mutable post fields — only changes when actual data differs
  const postDataKey = useMemo(
    () =>
      `${post.id}-${post.user_reaction}-${post.comment_count}-${post.reaction_counts.like}:${post.reaction_counts.love}:${post.reaction_counts.celebrate}:${post.reaction_counts.insightful}:${post.reaction_counts.curious}`,
    [post.id, post.user_reaction, post.comment_count, post.reaction_counts]
  );

  // Sync local state back to server truth after revalidatePath delivers new props
  useEffect(() => {
    setOptimisticReactionCounts(post.reaction_counts);
    setOptimisticUserReaction(post.user_reaction);
    setOptimisticComments(post.comments);
    setOptimisticCommentCount(post.comment_count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postDataKey]);

  // ─── Optimistic callbacks ──────────────────────────────────────────

  const handleOptimisticReaction = useCallback(
    (reactionType: ReactionType) => {
      setOptimisticReactionCounts((prev) => {
        const newCounts = { ...prev };
        if (optimisticUserReaction === reactionType) {
          // Same reaction → toggle off (decrement)
          newCounts[reactionType] = Math.max(0, newCounts[reactionType] - 1);
        } else if (optimisticUserReaction) {
          // Different reaction → switch (decrement old, increment new)
          newCounts[optimisticUserReaction] = Math.max(
            0,
            newCounts[optimisticUserReaction] - 1
          );
          newCounts[reactionType] = newCounts[reactionType] + 1;
        } else {
          // No reaction → add (increment)
          newCounts[reactionType] = newCounts[reactionType] + 1;
        }
        return newCounts;
      });
      setOptimisticUserReaction((prev) =>
        prev === reactionType ? null : reactionType
      );
    },
    [optimisticUserReaction]
  );

  const handleOptimisticComment = useCallback(
    (comment: CommentWithAuthor, parentId?: string) => {
      if (parentId) {
        // Reply: find parent and append to its replies
        setOptimisticComments((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? { ...c, replies: [...c.replies, comment] }
              : c
          )
        );
      } else {
        // Top-level comment: append to list
        setOptimisticComments((prev) => [...prev, comment]);
      }
      setOptimisticCommentCount((prev) => prev + 1);
    },
    []
  );

  const handleOptimisticCommentReaction = useCallback(
    (
      commentId: string,
      reactionType: ReactionType,
      currentUserReaction: ReactionType | null
    ) => {
      const updateComment = (
        comment: CommentWithAuthor
      ): CommentWithAuthor => {
        if (comment.id !== commentId) {
          // Check replies
          return {
            ...comment,
            replies: comment.replies.map(updateComment),
          };
        }
        const newCounts = { ...comment.reaction_counts };
        let newUserReaction: ReactionType | null;
        if (currentUserReaction === reactionType) {
          // Same → remove
          newCounts[reactionType] = Math.max(0, newCounts[reactionType] - 1);
          newUserReaction = null;
        } else if (currentUserReaction) {
          // Different → switch
          newCounts[currentUserReaction] = Math.max(
            0,
            newCounts[currentUserReaction] - 1
          );
          newCounts[reactionType] = newCounts[reactionType] + 1;
          newUserReaction = reactionType;
        } else {
          // No reaction → add
          newCounts[reactionType] = newCounts[reactionType] + 1;
          newUserReaction = reactionType;
        }
        return {
          ...comment,
          reaction_counts: newCounts,
          user_reaction: newUserReaction,
        };
      };
      setOptimisticComments((prev) => prev.map(updateComment));
    },
    []
  );

  // ─── Derived values ────────────────────────────────────────────────

  const isAuthor = post.author_id === currentUserId;
  const canModify = isAuthor || isHRAdmin;

  const displayName =
    post.author.preferred_name || post.author.full_name || "User";

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <>
      <Card className={post.is_weekly_roundup ? "border-primary/30 bg-primary/5" : undefined}>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={post.author.avatar_url || undefined}
                    alt={displayName}
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{displayName}</p>
                    {post.is_pinned && (
                      <Badge variant="secondary" className="text-xs gap-1 py-0">
                        <Pin className="h-3 w-3" />
                        Pinned
                      </Badge>
                    )}
                    {post.is_weekly_roundup && (
                      <Badge variant="default" className="text-xs gap-1 py-0">
                        <Sparkles className="h-3 w-3" />
                        Round Up
                      </Badge>
                    )}
                  </div>
                  {post.author.job_title && (
                    <p className="text-xs text-muted-foreground">
                      {post.author.job_title}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {timeAgo(post.created_at)}
                  </p>
                </div>
              </div>

              {canModify && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isAuthor && (
                      <DropdownMenuItem
                        onSelect={() => setShowEditDialog(true)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Post
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Post
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Content */}
            <div className="whitespace-pre-wrap text-sm break-words">
              {post.content}
            </div>

            {/* Attachments */}
            <AttachmentDisplay attachments={post.attachments} />

            {/* Reactions */}
            <ReactionBar
              postId={post.id}
              reactionCounts={optimisticReactionCounts}
              userReaction={optimisticUserReaction}
              commentCount={optimisticCommentCount}
              onCommentClick={() => setCommentsExpanded(true)}
              onOptimisticReaction={handleOptimisticReaction}
            />

            {/* Comments */}
            <CommentSection
              postId={post.id}
              comments={optimisticComments}
              commentCount={optimisticCommentCount}
              currentUserId={currentUserId}
              currentUserProfile={currentUserProfile}
              isHRAdmin={isHRAdmin}
              expanded={commentsExpanded}
              onToggleExpanded={setCommentsExpanded}
              onOptimisticComment={handleOptimisticComment}
              onOptimisticCommentReaction={handleOptimisticCommentReaction}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <PostEditDialog
        postId={post.id}
        initialContent={post.content}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
      <PostDeleteDialog
        postId={post.id}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </>
  );
}
