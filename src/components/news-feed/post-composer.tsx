"use client";

import { useState, useTransition, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { createPost } from "@/app/(protected)/intranet/actions";
import { AttachmentEditor, type PendingAttachment } from "./attachment-editor";
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

  const displayName =
    userProfile.preferred_name || userProfile.full_name || "User";

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

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
          link_url: a.link_url,
          link_title: a.link_title,
          link_description: a.link_description,
          link_image_url: a.link_image_url,
        })),
      });

      if (result.success) {
        setContent("");
        setAttachments([]);
        setResetKey((k) => k + 1);
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
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share something with the team..."
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
              rows={3}
              maxLength={5000}
              disabled={isPending}
            />

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
