"use client";

import { useState, useEffect, useMemo, useTransition, useCallback, useRef } from "react";
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
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { POST_MAX_LENGTH } from "@/lib/intranet";
import type { TiptapDocument } from "@/lib/tiptap";
import { useAutoLinkPreview } from "@/hooks/use-auto-link-preview";
import type { AutoLinkPreview } from "@/hooks/use-auto-link-preview";
import { editPost, discardStagedAttachments } from "@/app/(protected)/intranet/actions";
import { AttachmentEditor, type PendingAttachment, type AttachmentEditorHandle } from "./attachment-editor";
import { LinkPreviewCard } from "./link-preview-card";
import { TiptapComposer } from "./tiptap-composer";
import { ComposerActionBar } from "./composer-action-bar";
import type { MentionUser } from "./mention-list";
import type { PostAttachment } from "@/types/database.types";

function mapExistingToPending(
  attachments: PostAttachment[]
): PendingAttachment[] {
  return attachments.map((att) => ({
    id: att.id,
    type: att.attachment_type,
    isExisting: true,
    file_url: att.file_url ?? undefined,
    drive_file_id: att.drive_file_id ?? undefined,
    file_name: att.file_name ?? undefined,
    file_size: att.file_size ?? undefined,
    mime_type: att.mime_type ?? undefined,
    image_width: att.image_width ?? undefined,
    image_height: att.image_height ?? undefined,
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
  initialContentJson?: TiptapDocument | Record<string, unknown> | null;
  initialAttachments: PostAttachment[];
  mentionUsers?: MentionUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostEditDialog({
  postId,
  initialContent,
  initialContentJson,
  initialAttachments,
  mentionUsers = [],
  open,
  onOpenChange,
}: PostEditDialogProps) {
  const [content, setContent] = useState(initialContent);
  const [contentJson, setContentJson] = useState<TiptapDocument | null>(
    (initialContentJson as TiptapDocument) ?? null
  );
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [resetKey, setResetKey] = useState(0);
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);
  const attachmentEditorRef = useRef<AttachmentEditorHandle>(null);

  // Memoise non-link attachments for AttachmentEditor (avoids new array ref every render)
  const initialNonLinkAttachments = useMemo(
    () => filterNonLinkAttachments(mapExistingToPending(initialAttachments)),
    [initialAttachments]
  );

  // Build Tiptap-compatible initial content — convert plain text for old posts without content_json
  const tiptapInitialContent = useMemo<TiptapDocument | undefined>(() => {
    if (initialContentJson) return initialContentJson as TiptapDocument;
    if (!initialContent) return undefined;
    // Convert plain text to minimal Tiptap document
    return {
      type: "doc",
      content: initialContent.split("\n").map((line) => ({
        type: "paragraph",
        content: line ? [{ type: "text", text: line }] : [],
      })),
    };
  }, [initialContentJson, initialContent]);

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

  // Reset state when dialog opens to pick up latest data (intentional setState in effect for prop sync)
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state from prop change on dialog open
      setContent(initialContent);
      setContentJson((initialContentJson as TiptapDocument) ?? null);
      setAttachments(initialNonLinkAttachments);
      setError(null);
      setResetKey((k) => k + 1);
      resetPreview(initialPreview);
    }
  }, [open, initialContent, initialContentJson, initialNonLinkAttachments, initialPreview, resetPreview]);

  // Detect unsaved changes
  const hasChanges = useMemo(() => {
    if (content !== initialContent) return true;

    // Check non-link attachment changes
    const initialNonLinkIds = initialNonLinkAttachments
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
    initialNonLinkAttachments,
    initialLinkAttachment,
    autoLinkPreview,
  ]);

  const handleEditorChange = useCallback(
    (json: TiptapDocument, text: string) => {
      setContentJson(json);
      setContent(text);
    },
    []
  );

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
    // Clean up newly-uploaded staging files. Existing attachments
    // (isExisting=true) point at post_attachments rows — leave them alone.
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

  const handleSave = () => {
    if (!content.trim()) return;
    if (attachments.some((a) => a.uploading)) return;
    setError(null);

    startTransition(async () => {
      // Only send non-link attachments — server auto-detects links from content
      const result = await editPost(postId, {
        content: content.trim(),
        content_json: contentJson,
        attachments: attachments.map((a) => ({
          id: a.isExisting ? a.id : undefined,
          attachment_type: a.type,
          file_url: a.file_url,
          drive_file_id: a.drive_file_id,
          file_name: a.file_name,
          file_size: a.file_size,
          mime_type: a.mime_type,
          image_width: a.image_width,
          image_height: a.image_height,
        })),
      });
      if (result.success) {
        toast.success("Post updated");
        onOpenChange(false);
      } else {
        setError(result.error);
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
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
          className="max-w-lg gap-0"
          // No DialogDescription — the editor is visually self-explanatory.
          // Explicit undefined opts out of Radix's default aria-describedby
          // warning. Screen readers fall back to the DialogTitle.
          aria-describedby={undefined}
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
            <DialogTitle>Edit post</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-3">
            <div>
              <TiptapComposer
                mentionUsers={mentionUsers}
                placeholder="Edit your post..."
                onChange={handleEditorChange}
                maxLength={POST_MAX_LENGTH}
                disabled={isPending}
                resetKey={resetKey}
                initialContent={tiptapInitialContent}
                borderless
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
              ref={attachmentEditorRef}
              initialAttachments={initialNonLinkAttachments}
              onChange={handleAttachmentsChange}
              onError={setError}
              disabled={isPending}
              resetKey={resetKey}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Action bar with divider */}
          <div className="mt-3 border-t pt-3">
            <ComposerActionBar
              onPhotoClick={() => attachmentEditorRef.current?.triggerImageUpload()}
              onDocumentClick={() => attachmentEditorRef.current?.triggerDocumentUpload()}
              onPollClick={() => {/* Polls not supported in edit mode */}}
              pollActive={true}
              disabled={isPending}
              actionButton={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClose}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSave}
                    size="sm"
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
                </div>
              }
            />
          </div>
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
