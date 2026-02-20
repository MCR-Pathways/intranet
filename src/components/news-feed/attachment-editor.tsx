"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, Paperclip, Link2, X, Loader2 } from "lucide-react";
import {
  uploadPostAttachment,
  fetchLinkPreview,
} from "@/app/(protected)/intranet/actions";
import type { AttachmentType } from "@/types/database.types";

export interface PendingAttachment {
  id: string;
  type: AttachmentType;
  isExisting?: boolean;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  link_url?: string;
  link_title?: string;
  link_description?: string;
  link_image_url?: string;
  preview?: string;
  uploading?: boolean;
}

interface AttachmentEditorProps {
  initialAttachments?: PendingAttachment[];
  onChange: (attachments: PendingAttachment[]) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  /** When this value changes, internal state resets to initialAttachments */
  resetKey?: string | number;
}

export function AttachmentEditor({
  initialAttachments,
  onChange,
  onError,
  disabled,
  resetKey,
}: AttachmentEditorProps) {
  const [attachments, setAttachments] = useState<PendingAttachment[]>(
    initialAttachments ?? []
  );
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Reset internal state when resetKey changes
  useEffect(() => {
    setAttachments(initialAttachments ?? []);
    setLinkInput("");
    setShowLinkInput(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Notify parent whenever attachments change
  useEffect(() => {
    onChange(attachments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments]);

  const handleFileUpload = useCallback(
    async (files: FileList | null, type: "image" | "document") => {
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
          onError?.(result.error ?? "Upload failed");
        }
      }
    },
    [onError]
  );

  const handleAddLink = useCallback(async () => {
    const url = linkInput.trim();
    if (!url) return;

    const tempId = crypto.randomUUID();
    setAttachments((prev) => [
      ...prev,
      { id: tempId, type: "link", link_url: url, uploading: true },
    ]);
    setLinkInput("");
    setShowLinkInput(false);

    const linkPreview = await fetchLinkPreview(url);

    setAttachments((prev) =>
      prev.map((a) =>
        a.id === tempId
          ? {
              ...a,
              link_title: linkPreview.title,
              link_description: linkPreview.description,
              link_image_url: linkPreview.imageUrl,
              uploading: false,
            }
          : a
      )
    );
  }, [linkInput]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att?.preview) URL.revokeObjectURL(att.preview);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  return (
    <div className="space-y-3">
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
                /* eslint-disable-next-line @next/next/no-img-element -- temporary blob URL preview */
                <img
                  src={att.preview}
                  alt=""
                  className="h-8 w-8 rounded object-cover"
                />
              )}
              {att.type === "image" && att.isExisting && att.file_url && !att.preview && (
                /* eslint-disable-next-line @next/next/no-img-element -- existing attachment thumbnail */
                <img
                  src={att.file_url}
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
                disabled={disabled}
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

      {/* Toolbar */}
      <div className="flex gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files, "image")}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
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
          onChange={(e) => handleFileUpload(e.target.files, "document")}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => docInputRef.current?.click()}
          disabled={disabled}
        >
          <Paperclip className="mr-1.5 h-4 w-4" />
          Document
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowLinkInput(true)}
          disabled={disabled || showLinkInput}
        >
          <Link2 className="mr-1.5 h-4 w-4" />
          Link
        </Button>
      </div>
    </div>
  );
}
