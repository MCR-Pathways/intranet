"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { POST_MAX_LENGTH } from "@/lib/intranet";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { useAutoLinkPreview } from "@/hooks/use-auto-link-preview";
import { createPost } from "@/app/(protected)/intranet/actions";
import { AttachmentEditor, type PendingAttachment } from "./attachment-editor";
import { LinkPreviewCard } from "./link-preview-card";
import type { PostAuthor } from "@/types/database.types";

interface PostComposerProps {
  userProfile: PostAuthor;
}

export function PostComposer({ userProfile }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [resetKey, setResetKey] = useState(0);
  const { textareaRef, resize } = useAutoResizeTextarea(80);
  const { autoLinkPreview, isFetchingPreview, dismissPreview, resetPreview } =
    useAutoLinkPreview({ content });

  const displayName =
    userProfile.preferred_name || userProfile.full_name || "User";

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  // Warn before navigating away with unsaved content
  useEffect(() => {
    const hasContent = content.trim().length > 0 || attachments.length > 0;
    if (!hasContent) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [content, attachments]);

  const handleAttachmentsChange = useCallback(
    (updated: PendingAttachment[]) => {
      setAttachments(updated);
    },
    []
  );

  const handleSubmit = () => {
    if (!content.trim() && attachments.length === 0) return;
    if (attachments.some((a) => a.uploading)) return;

    setError(null);
    startTransition(async () => {
      const result = await createPost({
        content: content.trim(),
        attachments: attachments.map((a) => ({
          attachment_type: a.type,
          file_url: a.file_url,
          file_name: a.file_name,
          file_size: a.file_size,
          mime_type: a.mime_type,
        })),
      });

      if (result.success) {
        setContent("");
        setAttachments([]);
        resetPreview();
        setResetKey((k) => k + 1);
        // Reset textarea height after clearing content
        requestAnimationFrame(() => resize());
        if (result.warning) {
          setError(result.warning);
        }
      } else {
        setError(result.error);
      }
    });
  };

  const isSubmitDisabled =
    isPending ||
    (!content.trim() && attachments.length === 0) ||
    attachments.some((a) => a.uploading);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage
              src={userProfile.avatar_url || undefined}
              alt={displayName}
            />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  resize();
                }}
                placeholder="Share something with the team..."
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
                rows={3}
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
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : null}
              </div>
            )}

            <AttachmentEditor
              onChange={handleAttachmentsChange}
              onError={setError}
              disabled={isPending}
              resetKey={resetKey}
            />

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Submit button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
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
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
