"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BarChart3, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn, getInitials } from "@/lib/utils";
import { POST_MAX_LENGTH } from "@/lib/intranet";
import type { TiptapDocument } from "@/lib/tiptap";
import { useAutoLinkPreview } from "@/hooks/use-auto-link-preview";
import { createPost } from "@/app/(protected)/intranet/actions";
import { AttachmentEditor, type PendingAttachment } from "./attachment-editor";
import { LinkPreviewCard } from "./link-preview-card";
import { PollComposer, type PollData, computePollClosesAt } from "./poll-composer";
import { TiptapComposer } from "./tiptap-composer";
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
  const { autoLinkPreview, isFetchingPreview, dismissPreview, resetPreview } =
    useAutoLinkPreview({ content: plainText });

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
                closes_at: computePollClosesAt(pollData.duration),
              },
            }
          : {}),
      });

      if (result.success) {
        setContentJson(null);
        setPlainText("");
        setAttachments([]);
        setPollData(null);
        resetPreview();
        setResetKey((k) => k + 1);
        if (result.warning) {
          setError(result.warning);
        } else {
          toast.success("Post published");
        }
      } else {
        setError(result.error);
        toast.error(result.error || "Something went wrong");
      }
    });
  }, [plainText, contentJson, attachments, pollData, resetPreview]);

  const charCount = plainText.length;
  const isSubmitDisabled =
    isPending ||
    (!plainText.trim() && attachments.length === 0) ||
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
              <TiptapComposer
                mentionUsers={mentionUsers}
                placeholder="Share something with the team..."
                onChange={handleEditorChange}
                onSubmit={handleSubmit}
                maxLength={POST_MAX_LENGTH}
                disabled={isPending}
                resetKey={resetKey}
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

            {/* Poll composer */}
            {pollData && (
              <PollComposer
                poll={pollData}
                onChange={setPollData}
                onRemove={() => setPollData(null)}
                disabled={isPending}
              />
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Submit button + add poll toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">
                  ⌘
                </kbd>{" "}
                +{" "}
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">
                  Enter
                </kbd>{" "}
                to post
                </p>
                {!pollData && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setPollData({ question: "", options: ["", ""], duration: "3d" })
                    }
                    disabled={isPending}
                  >
                    <BarChart3 className="mr-1 h-4 w-4" />
                    Poll
                  </Button>
                )}
              </div>
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
