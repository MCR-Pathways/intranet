"use client";

import { useState, useTransition, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImagePlus, Paperclip, Link2, X, Loader2 } from "lucide-react";
import { createPost, uploadPostAttachment, fetchLinkPreview } from "@/app/(protected)/intranet/actions";
import type { PostAuthor, AttachmentType } from "@/types/database.types";

interface PendingAttachment {
  id: string;
  type: AttachmentType;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  link_url?: string;
  link_title?: string;
  link_description?: string;
  link_image_url?: string;
  preview?: string; // local preview URL for images
  uploading?: boolean;
}

interface PostComposerProps {
  userProfile: PostAuthor;
}

export function PostComposer({ userProfile }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const displayName =
    userProfile.preferred_name || userProfile.full_name || "User";

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const handleFileUpload = async (
    files: FileList | null,
    type: "image" | "document"
  ) => {
    if (!files) return;

    for (const file of Array.from(files)) {
      const tempId = crypto.randomUUID();
      const preview =
        type === "image" ? URL.createObjectURL(file) : undefined;

      setAttachments((prev) => [
        ...prev,
        { id: tempId, type, file_name: file.name, preview, uploading: true },
      ]);

      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadPostAttachment(formData);

      if (result.success && result.url) {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === tempId
              ? {
                  ...a,
                  file_url: result.url,
                  file_name: result.fileName,
                  file_size: result.fileSize,
                  mime_type: result.mimeType,
                  uploading: false,
                }
              : a
          )
        );
      } else {
        setAttachments((prev) => prev.filter((a) => a.id !== tempId));
        setError(result.error ?? "Upload failed");
      }
    }
  };

  const handleAddLink = async () => {
    const url = linkInput.trim();
    if (!url) return;

    const tempId = crypto.randomUUID();
    setAttachments((prev) => [
      ...prev,
      { id: tempId, type: "link", link_url: url, uploading: true },
    ]);
    setLinkInput("");
    setShowLinkInput(false);

    const preview = await fetchLinkPreview(url);

    setAttachments((prev) =>
      prev.map((a) =>
        a.id === tempId
          ? {
              ...a,
              link_title: preview.title,
              link_description: preview.description,
              link_image_url: preview.imageUrl,
              uploading: false,
            }
          : a
      )
    );
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att?.preview) URL.revokeObjectURL(att.preview);
      return prev.filter((a) => a.id !== id);
    });
  };

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

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="relative flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm"
                  >
                    {att.uploading && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {att.type === "image" && att.preview && (
                      <img
                        src={att.preview}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                      />
                    )}
                    <span className="max-w-[150px] truncate">
                      {att.type === "link"
                        ? att.link_title || att.link_url
                        : att.file_name}
                    </span>
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted"
                      disabled={isPending}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Link input */}
            {showLinkInput && (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddLink();
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleAddLink}
                  disabled={!linkInput.trim()}
                >
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowLinkInput(false);
                    setLinkInput("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) =>
                    handleFileUpload(e.target.files, "image")
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPending}
                >
                  <ImagePlus className="mr-1.5 h-4 w-4" />
                  Photo
                </Button>

                <input
                  ref={docInputRef}
                  type="file"
                  accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  multiple
                  className="hidden"
                  onChange={(e) =>
                    handleFileUpload(e.target.files, "document")
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => docInputRef.current?.click()}
                  disabled={isPending}
                >
                  <Paperclip className="mr-1.5 h-4 w-4" />
                  Document
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLinkInput(true)}
                  disabled={isPending || showLinkInput}
                >
                  <Link2 className="mr-1.5 h-4 w-4" />
                  Link
                </Button>
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
