"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn, getInitials, getAvatarColour, filterAvatarUrl } from "@/lib/utils";
import { POST_MAX_LENGTH } from "@/lib/intranet";
import type { TiptapDocument } from "@/lib/tiptap";
import { useAutoLinkPreview } from "@/hooks/use-auto-link-preview";
import { createPost } from "@/app/(protected)/intranet/actions";
import type { PendingAttachment } from "./attachment-editor";
import { PollData, computePollClosesAt } from "./poll-composer";
import { ComposerActionBar } from "./composer-action-bar";
import { PostCreateDialog, type PendingAction } from "./post-create-dialog";
import type { MentionUser } from "./mention-list";
import type { PostAuthor } from "@/types/database.types";

interface PostComposerProps {
  userProfile: PostAuthor;
  mentionUsers: MentionUser[];
}

export function PostComposer({ userProfile, mentionUsers }: PostComposerProps) {
  const [contentJson, setContentJson] = useState<TiptapDocument | null>(null);
  const [plainText, setPlainText] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [resetKey, setResetKey] = useState(0);
  const [pollData, setPollData] = useState<PollData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const { autoLinkPreview, isFetchingPreview, dismissPreview, resetPreview } =
    useAutoLinkPreview({ content: plainText, enabled: dialogOpen });

  const displayName =
    userProfile.preferred_name || userProfile.full_name || "User";

  // Warn before navigating away with unsaved content
  useEffect(() => {
    const hasContent = plainText.trim().length > 0 || attachments.length > 0 || pollData !== null;
    if (!hasContent) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [plainText, attachments, pollData]);

  const handleEditorChange = useCallback(
    (json: TiptapDocument, text: string) => {
      setContentJson(json);
      setPlainText(text);
    },
    []
  );

  const handleAttachmentsChange = useCallback(
    (updated: PendingAttachment[]) => {
      setAttachments(updated);
    },
    []
  );

  const handleSubmit = useCallback(() => {
    const text = plainText.trim();
    if (!text && attachments.length === 0) return;
    if (attachments.some((a) => a.uploading)) return;

    // Validate poll if present
    if (pollData) {
      const filledOptions = pollData.options.filter((o) => o.trim().length > 0);
      if (!pollData.question.trim() || filledOptions.length < 2) {
        setError("Poll needs a question and at least 2 options");
        return;
      }
      if (pollData.duration === "custom") {
        if (!pollData.customCloseDate) {
          setError("Please select a date and time for the poll to close");
          return;
        }
        if (new Date(pollData.customCloseDate) <= new Date()) {
          setError("Poll close date must be in the future");
          return;
        }
      }
    }

    setError(null);
    startTransition(async () => {
      const result = await createPost({
        content: text,
        content_json: contentJson,
        attachments: attachments.map((a) => ({
          attachment_type: a.type,
          file_url: a.file_url,
          file_name: a.file_name,
          file_size: a.file_size,
          mime_type: a.mime_type,
        })),
        ...(pollData
          ? {
              poll: {
                question: pollData.question,
                options: pollData.options.filter((o) => o.trim().length > 0),
                closes_at: computePollClosesAt(pollData.duration, pollData.customCloseDate),
                allow_multiple: pollData.allowMultiple,
              },
            }
          : {}),
      });

      if (result.success) {
        // Close dialog — handleDialogOpenChange resets all state
        setDialogOpen(false);
        if (result.warning) {
          setError(result.warning);
        } else {
          toast.success("Post published");
        }
      } else {
        setError(result.error);
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
      }
    });
  }, [plainText, contentJson, attachments, pollData]);

  // Reset state when dialog closes (if no content — discarded)
  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setDialogOpen(open);
      if (!open) {
        // Reset all state when dialog is closed (user discarded or submitted)
        setContentJson(null);
        setPlainText("");
        setAttachments([]);
        setPollData(null);
        setError(null);
        resetPreview();
        setResetKey((k) => k + 1);
      }
    },
    [resetPreview]
  );

  const handleClearPendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  const openDialog = useCallback((action?: PendingAction) => {
    setPendingAction(action ?? null);
    setDialogOpen(true);
  }, []);

  const charCount = plainText.length;
  const isSubmitDisabled =
    isPending ||
    (!plainText.trim() && attachments.length === 0) ||
    attachments.some((a) => a.uploading);

  return (
    <>
      {/* Collapsed trigger card */}
      <Card>
        <CardContent className="pt-4 pb-3">
          {/* Avatar + pill trigger */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage
                src={filterAvatarUrl(userProfile.avatar_url)}
                alt={displayName}
              />
              <AvatarFallback className={cn(getAvatarColour(displayName).bg, getAvatarColour(displayName).fg, "text-sm")}>
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => openDialog()}
              className="flex-1 cursor-pointer rounded-full bg-muted px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/80"
            >
              Share something with the team...
            </button>
          </div>

          {/* Divider + action bar */}
          <div className="mt-3 border-t pt-3">
            <ComposerActionBar
              onPhotoClick={() => openDialog("photo")}
              onDocumentClick={() => openDialog("document")}
              onPollClick={() => openDialog("poll")}
              pollActive={false}
              disabled={false}
            />
          </div>
        </CardContent>
      </Card>

      {/* Create post dialog */}
      <PostCreateDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        pendingAction={pendingAction}
        onClearPendingAction={handleClearPendingAction}
        userProfile={userProfile}
        mentionUsers={mentionUsers}
        plainText={plainText}
        charCount={charCount}
        contentJson={contentJson}
        attachments={attachments}
        pollData={pollData}
        autoLinkPreview={autoLinkPreview}
        isFetchingPreview={isFetchingPreview}
        error={error}
        isPending={isPending}
        isSubmitDisabled={isSubmitDisabled}
        resetKey={resetKey}
        onEditorChange={handleEditorChange}
        onAttachmentsChange={handleAttachmentsChange}
        onPollChange={setPollData}
        onDismissPreview={dismissPreview}
        onSubmit={handleSubmit}
        onSetError={setError}
      />
    </>
  );
}
