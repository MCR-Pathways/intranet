"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, X } from "lucide-react";
import { cn, getInitials, getAvatarColour, filterAvatarUrl } from "@/lib/utils";
import { POST_MAX_LENGTH } from "@/lib/intranet";
import type { TiptapDocument } from "@/lib/tiptap";
import type { AutoLinkPreview } from "@/hooks/use-auto-link-preview";
import { AttachmentEditor, type PendingAttachment, type AttachmentEditorHandle } from "./attachment-editor";
import { discardStagedAttachments } from "@/app/(protected)/intranet/actions";
import { useDialogDropZone } from "./use-dialog-drop-zone";
import { LinkPreviewCard } from "./link-preview-card";
import { PollComposer, type PollData } from "./poll-composer";
import { TiptapComposer } from "./tiptap-composer";
import { ComposerActionBar } from "./composer-action-bar";
import type { MentionUser } from "./mention-list";
import type { PostAuthor } from "@/types/database.types";

export type PendingAction = "photo" | "document" | "poll" | null;

/** Time (ms) for the Radix Dialog open animation to complete and child refs to mount. */
const DIALOG_ANIMATION_DELAY = 150;

interface PostCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingAction: PendingAction;
  onClearPendingAction: () => void;
  userProfile: PostAuthor;
  mentionUsers: MentionUser[];
  // State from parent
  plainText: string;
  charCount: number;
  contentJson: TiptapDocument | null;
  attachments: PendingAttachment[];
  pollData: PollData | null;
  autoLinkPreview: AutoLinkPreview | null;
  isFetchingPreview: boolean;
  error: string | null;
  isPending: boolean;
  isSubmitDisabled: boolean;
  resetKey: number;
  // Handlers from parent
  onEditorChange: (json: TiptapDocument, text: string) => void;
  onAttachmentsChange: (attachments: PendingAttachment[]) => void;
  onPollChange: (poll: PollData | null) => void;
  onDismissPreview: () => void;
  onSubmit: () => void;
  onSetError: (error: string | null) => void;
}

export function PostCreateDialog({
  open,
  onOpenChange,
  pendingAction,
  onClearPendingAction,
  userProfile,
  mentionUsers,
  plainText,
  charCount,
  attachments,
  pollData,
  autoLinkPreview,
  isFetchingPreview,
  error,
  isPending,
  isSubmitDisabled,
  resetKey,
  onEditorChange,
  onAttachmentsChange,
  onPollChange,
  onDismissPreview,
  onSubmit,
  onSetError,
}: PostCreateDialogProps) {
  const attachmentEditorRef = useRef<AttachmentEditorHandle>(null);
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);

  const displayName =
    userProfile.preferred_name || userProfile.full_name || "User";

  const hasContent =
    plainText.trim().length > 0 ||
    attachments.length > 0 ||
    pollData !== null;

  // Handle pending action (e.g. user clicked Photo in collapsed card)
  useEffect(() => {
    if (!open || !pendingAction) return;

    // Wait for the Radix Dialog open animation to complete and child components
    // (e.g. AttachmentEditor) to mount so their refs are available for file pickers.
    const timer = setTimeout(() => {
      switch (pendingAction) {
        case "photo":
          attachmentEditorRef.current?.triggerImageUpload();
          break;
        case "document":
          attachmentEditorRef.current?.triggerDocumentUpload();
          break;
        case "poll":
          onPollChange({ question: "", options: ["", ""], duration: "3d", customCloseDate: undefined, allowMultiple: false });
          break;
      }
      onClearPendingAction();
    }, DIALOG_ANIMATION_DELAY);

    return () => clearTimeout(timer);
  }, [open, pendingAction, onClearPendingAction, onPollChange]);

  const handleClose = useCallback(() => {
    if (hasContent && !isPending) {
      setShowDiscardAlert(true);
    } else {
      onOpenChange(false);
    }
  }, [hasContent, isPending, onOpenChange]);

  // Drag-and-drop catches drops anywhere on the dialog and routes them
  // through the AttachmentEditor's upload pipeline. Without this, drops
  // outside the AttachmentEditor's small wrapper triggered the browser's
  // default "navigate to file" behaviour (visible as a brief flash).
  const { isDragging, dropHandlers } = useDialogDropZone((files) => {
    attachmentEditorRef.current?.handleDroppedFiles(files);
  });

  const handleDiscard = useCallback(() => {
    // Clean up any Drive files staged in this composer session before closing.
    // Fire-and-forget — the daily cron sweeps anything that escapes.
    const stagedIds = attachments
      .filter((a) => !a.isExisting && a.drive_file_id)
      .map((a) => a.drive_file_id as string);
    if (stagedIds.length > 0) {
      void discardStagedAttachments(stagedIds).catch(() => {
        // best-effort
      });
    }
    setShowDiscardAlert(false);
    onOpenChange(false);
  }, [attachments, onOpenChange]);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            handleClose();
          } else {
            onOpenChange(true);
          }
        }}
      >
        <DialogContent
          // Don't add `relative` here — DialogContent's base styles use
          // `position: fixed` for viewport centering. Tailwind treats `fixed`
          // and `relative` as the same `position` property; whichever class
          // resolves last wins, and `relative` would drop the dialog to its
          // natural document position (bottom of the page on a long feed).
          // `position: fixed` already establishes a containing block for
          // absolute-positioned children, so the drop overlay's `inset-0`
          // works without it.
          className="max-w-lg gap-0"
          // No DialogDescription — the composer is visually self-explanatory.
          // Explicit undefined opts out of Radix's default aria-describedby
          // warning. Screen readers fall back to the DialogTitle.
          aria-describedby={undefined}
          onInteractOutside={(e) => {
            if (hasContent) {
              e.preventDefault();
              setShowDiscardAlert(true);
            }
          }}
          onEscapeKeyDown={(e) => {
            if (hasContent) {
              e.preventDefault();
              setShowDiscardAlert(true);
            }
          }}
          {...dropHandlers}
        >
          {/* Drop overlay — covers the whole dialog body so users can drop
              files anywhere, not just on the AttachmentEditor's wrapper. */}
          {isDragging && (
            <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm pointer-events-none">
              <p className="text-base font-medium text-primary">Drop files to attach</p>
            </div>
          )}
          <DialogHeader>
            <DialogTitle>Create post</DialogTitle>
          </DialogHeader>

          {/* Author row */}
          <div className="flex items-center gap-3 py-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage
                src={filterAvatarUrl(userProfile.avatar_url)}
                alt={displayName}
              />
              <AvatarFallback className={cn(getAvatarColour(displayName).bg, getAvatarColour(displayName).fg, "text-sm")}>
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <p className="font-medium text-sm">{displayName}</p>
          </div>

          {/* Editor area */}
          <div className="space-y-3">
            <div>
              <TiptapComposer
                mentionUsers={mentionUsers}
                placeholder="Share something with the team..."
                onChange={onEditorChange}
                onSubmit={onSubmit}
                maxLength={POST_MAX_LENGTH}
                disabled={isPending}
                resetKey={resetKey}
                borderless
              />
              {charCount > 0 && (
                <p
                  className={cn(
                    "mt-1 text-right text-xs text-muted-foreground",
                    charCount > POST_MAX_LENGTH * 0.9 && "text-amber-500",
                    charCount >= POST_MAX_LENGTH && "text-destructive"
                  )}
                >
                  {charCount.toLocaleString()} /{" "}
                  {POST_MAX_LENGTH.toLocaleString()}
                </p>
              )}
            </div>

            {/* Auto-detected link preview (compact) */}
            {(autoLinkPreview || isFetchingPreview) && (
              <div className="relative">
                {isFetchingPreview && !autoLinkPreview ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Loading preview...
                    </span>
                  </div>
                ) : autoLinkPreview ? (
                  <>
                    <LinkPreviewCard
                      url={autoLinkPreview.url}
                      title={autoLinkPreview.title}
                      description={autoLinkPreview.description}
                      imageUrl={autoLinkPreview.imageUrl}
                      variant="compact"
                    />
                    <button
                      type="button"
                      onClick={onDismissPreview}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : null}
              </div>
            )}

            <AttachmentEditor
              ref={attachmentEditorRef}
              onChange={onAttachmentsChange}
              onError={onSetError}
              disabled={isPending}
              resetKey={resetKey}
            />

            {/* Poll composer */}
            {pollData && (
              <PollComposer
                poll={pollData}
                onChange={onPollChange}
                onRemove={() => onPollChange(null)}
                disabled={isPending}
              />
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {/* Action bar with divider */}
          <div className="mt-3 border-t pt-3">
            <ComposerActionBar
              onPhotoClick={() => attachmentEditorRef.current?.triggerImageUpload()}
              onDocumentClick={() => attachmentEditorRef.current?.triggerDocumentUpload()}
              onPollClick={() =>
                onPollChange({ question: "", options: ["", ""], duration: "3d", customCloseDate: undefined, allowMultiple: false })
              }
              pollActive={pollData !== null}
              disabled={isPending}
              actionButton={
                <Button
                  type="button"
                  onClick={onSubmit}
                  disabled={isSubmitDisabled}
                  size="sm"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    "Post"
                  )}
                </Button>
              }
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard changes confirmation */}
      <AlertDialog open={showDiscardAlert} onOpenChange={setShowDiscardAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard post?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved content. Are you sure you want to discard it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDiscardAlert(false)}
            >
              Keep Editing
            </Button>
            <Button variant="destructive" onClick={handleDiscard}>
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
