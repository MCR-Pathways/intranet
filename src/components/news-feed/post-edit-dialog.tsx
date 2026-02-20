"use client";

import { useState, useEffect, useMemo, useTransition, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { POST_MAX_LENGTH } from "@/lib/intranet";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { useAutoLinkPreview } from "@/hooks/use-auto-link-preview";
import type { AutoLinkPreview } from "@/hooks/use-auto-link-preview";
import { editPost } from "@/app/(protected)/intranet/actions";
import { AttachmentEditor, type PendingAttachment } from "./attachment-editor";
import { LinkPreviewCard } from "./link-preview-card";
import type { PostAttachment } from "@/types/database.types";

function mapExistingToPending(
  attachments: PostAttachment[]
): PendingAttachment[] {
  return attachments.map((att) => ({
    id: att.id,
    type: att.attachment_type,
    isExisting: true,
    file_url: att.file_url ?? undefined,
    file_name: att.file_name ?? undefined,
    file_size: att.file_size ?? undefined,
    mime_type: att.mime_type ?? undefined,
    link_url: att.link_url ?? undefined,
    link_title: att.link_title ?? undefined,
    link_description: att.link_description ?? undefined,
    link_image_url: att.link_image_url ?? undefined,
  }));
}

/** Filter out link attachments — links are now auto-managed from text content */
function filterNonLinkAttachments(
  attachments: PendingAttachment[]
): PendingAttachment[] {
  return attachments.filter((a) => a.type !== "link");
}

interface PostEditDialogProps {
  postId: string;
  initialContent: string;
  initialAttachments: PostAttachment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostEditDialog({
  postId,
  initialContent,
  initialAttachments,
  open,
  onOpenChange,
}: PostEditDialogProps) {
  const [content, setContent] = useState(initialContent);
  const [attachments, setAttachments] = useState<PendingAttachment[]>(() =>
    filterNonLinkAttachments(mapExistingToPending(initialAttachments))
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [resetKey, setResetKey] = useState(0);
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);
  const { textareaRef, resize } = useAutoResizeTextarea(120);

  // Extract initial link attachment for pre-populating preview
  const initialLinkAttachment = useMemo(
    () => initialAttachments.find((a) => a.attachment_type === "link"),
    [initialAttachments]
  );

  // Build initial preview from existing link attachment
  const initialPreview = useMemo<AutoLinkPreview | null>(() => {
    if (!initialLinkAttachment) return null;
    return {
      url: initialLinkAttachment.link_url || "",
      title: initialLinkAttachment.link_title ?? undefined,
      description: initialLinkAttachment.link_description ?? undefined,
      imageUrl: initialLinkAttachment.link_image_url ?? undefined,
    };
  }, [initialLinkAttachment]);

  const { autoLinkPreview, isFetchingPreview, dismissPreview, resetPreview } =
    useAutoLinkPreview({ content, enabled: open, initialPreview });

  // Reset state when dialog opens to pick up latest data
  useEffect(() => {
    if (open) {
      setContent(initialContent);
      setAttachments(
        filterNonLinkAttachments(mapExistingToPending(initialAttachments))
      );
      setError(null);
      setResetKey((k) => k + 1);
      resetPreview(initialPreview);

      // Resize textarea after content is set
      requestAnimationFrame(() => resize());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Detect unsaved changes
  const hasChanges = useMemo(() => {
    if (content !== initialContent) return true;

    // Check non-link attachment changes
    const initialNonLinkIds = initialAttachments
      .filter((a) => a.attachment_type !== "link")
      .map((a) => a.id)
      .sort()
      .join(",");
    const currentExistingIds = attachments
      .filter((a) => a.isExisting)
      .map((a) => a.id)
      .sort()
      .join(",");
    const hasNewAttachments = attachments.some((a) => !a.isExisting);
    if (initialNonLinkIds !== currentExistingIds || hasNewAttachments) return true;

    // Check if link preview changed (dismissed or different URL)
    const initialLinkUrl = initialLinkAttachment?.link_url ?? null;
    const currentLinkUrl = autoLinkPreview?.url ?? null;
    if (initialLinkUrl !== currentLinkUrl) return true;

    return false;
  }, [
    content,
    initialContent,
    attachments,
    initialAttachments,
    initialLinkAttachment,
    autoLinkPreview,
  ]);

  const handleAttachmentsChange = useCallback(
    (updated: PendingAttachment[]) => {
      setAttachments(updated);
    },
    []
  );

  const handleClose = useCallback(() => {
    if (hasChanges && !isPending) {
      setShowDiscardAlert(true);
    } else {
      onOpenChange(false);
    }
  }, [hasChanges, isPending, onOpenChange]);

  const handleDiscard = useCallback(() => {
    setShowDiscardAlert(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSave = () => {
    if (!content.trim()) return;
    if (attachments.some((a) => a.uploading)) return;
    setError(null);

    startTransition(async () => {
      // Only send non-link attachments — server auto-detects links from content
      const result = await editPost(postId, {
        content: content.trim(),
        attachments: attachments.map((a) => ({
          id: a.isExisting ? a.id : undefined,
          attachment_type: a.type,
          file_url: a.file_url,
          file_name: a.file_name,
          file_size: a.file_size,
          mime_type: a.mime_type,
        })),
      });
      if (result.success) {
        onOpenChange(false);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(newOpen) => {
        if (!newOpen) {
          handleClose();
        } else {
          onOpenChange(true);
        }
      }}>
        <DialogContent
          className="max-w-lg"
          onInteractOutside={(e) => {
            if (hasChanges) {
              e.preventDefault();
              setShowDiscardAlert(true);
            }
          }}
          onEscapeKeyDown={(e) => {
            if (hasChanges) {
              e.preventDefault();
              setShowDiscardAlert(true);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  resize();
                }}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[120px]"
                rows={5}
                maxLength={POST_MAX_LENGTH}
                disabled={isPending}
              />
              {content.length > 0 && (
                <p
                  className={cn(
                    "mt-1 text-right text-xs text-muted-foreground",
                    content.length > POST_MAX_LENGTH * 0.9 && "text-amber-500",
                    content.length >= POST_MAX_LENGTH && "text-destructive"
                  )}
                >
                  {content.length.toLocaleString()} /{" "}
                  {POST_MAX_LENGTH.toLocaleString()}
                </p>
              )}
            </div>

            {/* Auto-detected link preview */}
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
                    />
                    <button
                      type="button"
                      onClick={dismissPreview}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                      disabled={isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : null}
              </div>
            )}

            <AttachmentEditor
              initialAttachments={filterNonLinkAttachments(
                mapExistingToPending(initialAttachments)
              )}
              onChange={handleAttachmentsChange}
              onError={setError}
              disabled={isPending}
              resetKey={resetKey}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                isPending ||
                !content.trim() ||
                attachments.some((a) => a.uploading)
              }
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard changes confirmation */}
      <AlertDialog open={showDiscardAlert} onOpenChange={setShowDiscardAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
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
