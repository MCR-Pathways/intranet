"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { editPost } from "@/app/(protected)/intranet/actions";
import { AttachmentEditor, type PendingAttachment } from "./attachment-editor";
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
    mapExistingToPending(initialAttachments)
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [resetKey, setResetKey] = useState(0);

  // Reset state when dialog opens to pick up latest data
  useEffect(() => {
    if (open) {
      setContent(initialContent);
      setAttachments(mapExistingToPending(initialAttachments));
      setError(null);
      setResetKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleAttachmentsChange = useCallback(
    (updated: PendingAttachment[]) => {
      setAttachments(updated);
    },
    []
  );

  const handleSave = () => {
    if (!content.trim()) return;
    if (attachments.some((a) => a.uploading)) return;
    setError(null);

    startTransition(async () => {
      const result = await editPost(postId, {
        content: content.trim(),
        attachments: attachments.map((a) => ({
          id: a.isExisting ? a.id : undefined,
          attachment_type: a.type,
          file_url: a.file_url,
          file_name: a.file_name,
          file_size: a.file_size,
          mime_type: a.mime_type,
          link_url: a.link_url,
          link_title: a.link_title,
          link_description: a.link_description,
          link_image_url: a.link_image_url,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[120px]"
            rows={5}
            maxLength={5000}
            disabled={isPending}
          />
          <AttachmentEditor
            initialAttachments={mapExistingToPending(initialAttachments)}
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
            onClick={() => onOpenChange(false)}
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
  );
}
