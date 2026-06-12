"use client";

import { useState, useEffect, useCallback, useMemo, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DestructiveMenuItem } from "@/components/ui/destructive-menu-item";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Pin, PinOff, Sparkles, Loader2, Lock, Download, Award } from "lucide-react";
import { POST_TYPES } from "@/lib/intranet";
import { togglePinPost } from "@/app/(protected)/intranet/actions";
import { toast } from "sonner";
import { cn, timeAgo, getInitials, getAvatarColour, filterAvatarUrl } from "@/lib/utils";
import { TiptapRenderer } from "./tiptap-renderer";
import { AttachmentDisplay } from "./attachment-display";
import { ReactionBar } from "./reaction-bar";
import { CommentSection } from "./comment-section";
import { PollDisplay } from "./poll-display";
import { PostTypePill } from "./post-type-pill";
import { postSpineClass } from "./post-accents";
import { PostEditDialog } from "./post-edit-dialog";
import { PostDeleteDialog } from "./post-delete-dialog";
import { ClosePollDialog } from "./close-poll-dialog";
import { ExportPollDialog } from "./export-poll-dialog";
import {
  KudosCreateDialog,
  type KudosEditTarget,
} from "./kudos-create-dialog";
import { isKudosCategory } from "@/lib/intranet";
import type { MentionUser } from "./mention-list";
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
  isHRAdmin: boolean;
  isSystemsAdmin?: boolean;
  mentionUsers?: MentionUser[];
  /** Start with comments expanded (used on standalone post page) */
  initialCommentsExpanded?: boolean;
  /** Called after post is deleted (used for redirect on standalone page) */
  onDeleted?: () => void;
}

export function PostCard({
  post,
  currentUserId,
  currentUserProfile,
  isHRAdmin,
  isSystemsAdmin = false,
  mentionUsers = [],
  initialCommentsExpanded = false,
  onDeleted,
}: PostCardProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showKudosEditDialog, setShowKudosEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showClosePollDialog, setShowClosePollDialog] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(initialCommentsExpanded);
  const [isPinPending, startPinTransition] = useTransition();

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

  const [showExportDialog, setShowExportDialog] = useState(false);

  // ─── Derived values ────────────────────────────────────────────────

  const isAuthor = post.author_id === currentUserId;
  const canModify = isAuthor || isHRAdmin;
  const pollIsOpen = !!post.poll && !post.poll.is_closed;
  const canClosePoll = pollIsOpen && (isAuthor || isSystemsAdmin);
  const pollIsClosed = !!post.poll && post.poll.is_closed;
  const canExportPoll = pollIsClosed && (isAuthor || isSystemsAdmin);
  const showKebab = canModify || canClosePoll || canExportPoll;

  const displayName =
    post.author.preferred_name || post.author.full_name || "User";

  const isKudos = post.post_type === POST_TYPES.KUDOS;
  const isPoll = !!post.poll;
  // Stable reference for the recipients array so downstream useMemo
  // deps don't churn — `post.kudos_recipients ?? []` would otherwise
  // hand back a fresh empty literal on every render.
  const kudosRecipients = useMemo(
    () => post.kudos_recipients ?? [],
    [post.kudos_recipients],
  );

  // Memoise the edit-mode target so the dialog's recipientById /
  // useEffect deps don't churn on every PostCard re-render. Recreates
  // when the underlying post fields actually change (post-save the
  // revalidatePath delivers a fresh post prop with a new content
  // and/or recipient list — those changes flow through here).
  const kudosEditTarget = useMemo<KudosEditTarget | undefined>(() => {
    // Edit mode still locks a single category until the multi-pick compose
    // lands (PR5b); the first of the 1-2 stored categories drives it.
    const firstCategory = post.kudos_categories?.[0];
    if (!isKudos || !isAuthor || !isKudosCategory(firstCategory)) {
      return undefined;
    }
    return {
      postId: post.id,
      message: post.content,
      category: firstCategory,
      // Map PostAuthor → MentionUser so the dialog's chip renderer
      // reads the same shape whether the recipient came from the live
      // mention list or this locked-from-the-record fallback.
      existingRecipients: kudosRecipients.map((r) => ({
        id: r.id,
        label: r.preferred_name || r.full_name || "Someone",
        avatar_url: r.avatar_url,
        job_title: r.job_title,
      })),
    };
  }, [
    isKudos,
    isAuthor,
    post.id,
    post.content,
    post.kudos_categories,
    kudosRecipients,
  ]);

  return (
    <>
      <Card
        id={`post-${post.id}`}
        className={cn(
          post.is_weekly_roundup && "border-primary/30 bg-primary/5",
          // Kudos cards lead with a yellow strip (top border) — single
          // signature accent, sized to read but not to dominate. Per
          // W4 design: restraint over flair; the strip says "this is
          // celebration" without a colour-coded category-per-card
          // explosion.
          isKudos && "border-t-4 border-t-mcr-yellow",
          // Left spine: pinned (orange) wins over poll (sky-blue); kudos keeps
          // its top strip and takes none. See postSpineClass for the §8.3 matrix.
          postSpineClass({ isPinned: post.is_pinned, isKudos, isPoll }),
        )}
      >
        <CardContent className="pt-6">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              {isKudos ? (
                <KudosHeader
                  senderName={displayName}
                  senderAvatarUrl={post.author.avatar_url}
                  recipients={kudosRecipients}
                  category={post.kudos_categories?.[0] ?? null}
                  createdAt={post.created_at}
                  edited={post.updated_at !== post.created_at}
                />
              ) : (
              <div className="flex gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={filterAvatarUrl(post.author.avatar_url)}
                    alt={displayName}
                  />
                  <AvatarFallback className={cn(getAvatarColour(displayName).bg, getAvatarColour(displayName).fg, "text-sm")}>
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{displayName}</p>
                    {/* Pinned status shows as a "Pinned" pill in the top-right
                        cluster (design-system §8.3); this inline slot stays for
                        content-type semantics like Round Up. */}
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
                    {post.updated_at !== post.created_at && (
                      <span className="ml-1">(edited)</span>
                    )}
                  </p>
                </div>
              </div>
              )}

              <div className="flex items-center gap-1.5">
                {/* Signature pills (design-system §8.3): pinned then poll, so a
                    pinned poll reads "Pinned · Poll". These are status, not
                    controls — the unpin action lives in the kebab below. */}
                {post.is_pinned && <PostTypePill type="pinned" />}
                {isPoll && <PostTypePill type="poll" />}
              {showKebab && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Post actions"
                      title="Actions"
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isAuthor && (
                      <DropdownMenuItem
                        onSelect={() =>
                          isKudos
                            ? setShowKudosEditDialog(true)
                            : setShowEditDialog(true)
                        }
                      >
                        <Pencil />
                        {isKudos ? "Edit Kudos" : "Edit Post"}
                      </DropdownMenuItem>
                    )}
                    {isHRAdmin && (
                      <DropdownMenuItem
                        onSelect={() => {
                          startPinTransition(async () => {
                            const result = await togglePinPost(post.id);
                            if (result.success) {
                              toast.success(post.is_pinned ? "Post unpinned" : "Post pinned");
                            } else {
                              toast.error(result.error ?? "Failed to update pin status");
                            }
                          });
                        }}
                        disabled={isPinPending}
                      >
                        {isPinPending ? (
                          <Loader2 className="animate-spin" />
                        ) : post.is_pinned ? (
                          <PinOff />
                        ) : (
                          <Pin />
                        )}
                        {post.is_pinned ? "Unpin Post" : "Pin Post"}
                      </DropdownMenuItem>
                    )}
                    {canClosePoll && (
                      <DropdownMenuItem
                        onSelect={() => setShowClosePollDialog(true)}
                      >
                        <Lock />
                        Close Poll
                      </DropdownMenuItem>
                    )}
                    {canExportPoll && (
                      <DropdownMenuItem
                        onSelect={() => setShowExportDialog(true)}
                      >
                        <Download />
                        Export Results
                      </DropdownMenuItem>
                    )}
                    {canModify && (
                      <DestructiveMenuItem
                        onSelect={() => setShowDeleteDialog(true)}
                      >
                        <Trash2 />
                        Delete post
                      </DestructiveMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              </div>
            </div>

            {/* Content */}
            <TiptapRenderer json={post.content_json as Record<string, unknown> | null} fallback={post.content} />

            {/* Attachments */}
            <AttachmentDisplay attachments={post.attachments} />

            {/* Poll */}
            {post.poll && (
              <PollDisplay postId={post.id} poll={post.poll} />
            )}

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
              currentUserId={currentUserId}
              currentUserProfile={currentUserProfile}
              isHRAdmin={isHRAdmin}
              mentionUsers={mentionUsers}
              expanded={commentsExpanded}
              onToggleExpanded={setCommentsExpanded}
              onOptimisticComment={handleOptimisticComment}
              onOptimisticCommentReaction={handleOptimisticCommentReaction}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      {/* Kudos posts swap the rich-text edit dialog for the kudos
          dialog in edit mode — same compose surface as create, with
          category and existing recipients locked. Mounted only for
          kudos posts so the create-mode hydration cost doesn't run on
          every news post. */}
      {kudosEditTarget && (
        <KudosCreateDialog
          open={showKudosEditDialog}
          onOpenChange={setShowKudosEditDialog}
          staff={mentionUsers ?? []}
          currentUserId={currentUserId}
          editTarget={kudosEditTarget}
        />
      )}
      <PostEditDialog
        postId={post.id}
        initialContent={post.content}
        initialContentJson={post.content_json as Record<string, unknown> | null}
        initialAttachments={post.attachments}
        mentionUsers={mentionUsers}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
      <PostDeleteDialog
        postId={post.id}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onDeleted={onDeleted}
      />
      <ClosePollDialog
        postId={post.id}
        open={showClosePollDialog}
        onOpenChange={setShowClosePollDialog}
      />
      {post.poll && (
        <ExportPollDialog
          postId={post.id}
          pollQuestion={post.poll.question}
          totalVotes={post.poll.total_votes}
          closedAt={post.poll.closes_at}
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
        />
      )}
    </>
  );
}

// ─── Kudos header ────────────────────────────────────────────────────
// Replaces the standard avatar/name/timestamp header for kudos posts.
// Reads "[Sender] sent kudos to [Recipients] for [Category]" — sender
// avatar leads, recipient names are the focus (recipients are the
// reason the post exists; the sender is incidental). Avatar stack on
// the recipient side at >=3 to keep names from sprawling.

interface KudosHeaderProps {
  senderName: string;
  senderAvatarUrl: string | null;
  recipients: PostAuthor[];
  category: string | null;
  createdAt: string;
  edited: boolean;
}

function KudosHeader({
  senderName,
  senderAvatarUrl,
  recipients,
  category,
  createdAt,
  edited,
}: KudosHeaderProps) {
  // Recipient list copy. 1-2: full names. 3+: first 2 + "and N others".
  // Tooltip on the "others" string reveals the rest. Avatar stack
  // shows up to 3 face circles; "+N" overflow when more.
  const recipientNames = recipients.map(
    (r) => r.preferred_name || r.full_name || "Someone",
  );
  const visibleAvatars = recipients.slice(0, 3);
  const overflowAvatarCount = Math.max(0, recipients.length - 3);

  let recipientLine: React.ReactNode;
  if (recipientNames.length === 0) {
    recipientLine = <span className="text-muted-foreground">no one</span>;
  } else if (recipientNames.length === 1) {
    recipientLine = (
      <strong className="text-foreground">{recipientNames[0]}</strong>
    );
  } else if (recipientNames.length === 2) {
    recipientLine = (
      <>
        <strong className="text-foreground">{recipientNames[0]}</strong> and{" "}
        <strong className="text-foreground">{recipientNames[1]}</strong>
      </>
    );
  } else {
    const extra = recipientNames.length - 2;
    const extraLabel = extra === 1 ? "1 other" : `${extra} others`;
    recipientLine = (
      <>
        <strong className="text-foreground">{recipientNames[0]}</strong>,{" "}
        <strong className="text-foreground">{recipientNames[1]}</strong> and{" "}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-foreground font-semibold underline decoration-dotted underline-offset-2 hover:decoration-solid"
            >
              {extraLabel}
            </button>
          </TooltipTrigger>
          <TooltipContent>{recipientNames.slice(2).join(", ")}</TooltipContent>
        </Tooltip>
      </>
    );
  }

  return (
    <div className="flex items-start gap-3 flex-1 min-w-0">
      {/* Award icon block — yellow accent matching the top strip,
          says "kudos" at a glance before the eye reaches the words. */}
      <span
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-mcr-yellow/20 text-foreground"
        aria-hidden="true"
      >
        <Award className="h-5 w-5" strokeWidth={2} />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug text-muted-foreground">
          <strong className="text-foreground">{senderName}</strong> sent kudos to{" "}
          {recipientLine}
          {category && (
            <>
              {" "}
              for <strong className="text-foreground">{category}</strong>
            </>
          )}
        </p>

        {/* Avatar stack — three max visible, plus +N overflow. Recipient
            avatars (not sender's) because recipients are the reason
            the post exists. Sender's name is in the line above. */}
        {recipients.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex -space-x-2">
              {visibleAvatars.map((r) => {
                const name = r.preferred_name || r.full_name || "Someone";
                return (
                  <Avatar
                    key={r.id}
                    className="h-7 w-7 border-2 border-card"
                  >
                    <AvatarImage
                      src={filterAvatarUrl(r.avatar_url)}
                      alt={name}
                    />
                    <AvatarFallback
                      className={cn(
                        getAvatarColour(name).bg,
                        getAvatarColour(name).fg,
                        "text-[10px]",
                      )}
                    >
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                );
              })}
              {overflowAvatarCount > 0 && (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium text-muted-foreground">
                  +{overflowAvatarCount}
                </span>
              )}
            </div>
            <Avatar className="h-6 w-6 ml-auto opacity-60">
              <AvatarImage
                src={filterAvatarUrl(senderAvatarUrl)}
                alt={senderName}
              />
              <AvatarFallback
                className={cn(
                  getAvatarColour(senderName).bg,
                  getAvatarColour(senderName).fg,
                  "text-[9px]",
                )}
              >
                {getInitials(senderName)}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        <p className="text-xs text-muted-foreground/70 mt-1.5">
          {timeAgo(createdAt)}
          {edited && <span className="ml-1">(edited)</span>}
        </p>
      </div>
    </div>
  );
}
