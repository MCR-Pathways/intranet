"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ImagePlus,
  Paperclip,
  X,
  Loader2,
  FileText,
} from "lucide-react";
import { formatFileSize } from "@/lib/utils";
import {
  validateFile,
  isImageType,
  ATTACHMENT_MAX_COUNT,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,
} from "@/lib/intranet";
import { uploadPostAttachment } from "@/app/(protected)/intranet/actions";
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
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Reset internal state when resetKey changes
  useEffect(() => {
    setAttachments(initialAttachments ?? []);
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

      // Check attachment count limit
      const remaining = ATTACHMENT_MAX_COUNT - attachments.length;
      if (remaining <= 0) {
        onError?.(`Maximum of ${ATTACHMENT_MAX_COUNT} attachments allowed`);
        return;
      }

      const filesToUpload = Array.from(files).slice(0, remaining);
      if (filesToUpload.length < files.length) {
        onError?.(
          `Only ${remaining} more attachment${remaining === 1 ? "" : "s"} can be added`
        );
      }

      for (const file of filesToUpload) {
        // Client-side validation
        const validationError = validateFile(file);
        if (validationError) {
          onError?.(validationError);
          continue;
        }

        const tempId = crypto.randomUUID();
        const preview =
          type === "image" ? URL.createObjectURL(file) : undefined;

        setAttachments((prev) => [
          ...prev,
          {
            id: tempId,
            type,
            file_name: file.name,
            file_size: file.size,
            preview,
            uploading: true,
          },
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
    [attachments.length, onError]
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att?.preview) URL.revokeObjectURL(att.preview);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  // ─── Drag and drop handlers ────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      // Determine type from first file's MIME type
      const firstFile = files[0];
      const type = isImageType(firstFile.type) ? "image" : "document";
      handleFileUpload(files, type);
    },
    [handleFileUpload]
  );

  // ─── Derived values ────────────────────────────────────────────────

  const imageAttachments = attachments.filter((a) => a.type === "image");
  const documentAttachments = attachments.filter(
    (a) => a.type === "document"
  );

  const acceptImages = ALLOWED_IMAGE_TYPES.join(",");
  const acceptDocs = ALLOWED_DOCUMENT_TYPES.join(",");

  return (
    <div
      className="relative space-y-3"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5">
          <p className="text-sm font-medium text-primary">Drop files here</p>
        </div>
      )}

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {/* Images — grid layout */}
          {imageAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imageAttachments.map((att) => (
                <div
                  key={att.id}
                  className="relative h-24 w-24 overflow-hidden rounded-lg border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob/existing URL preview */}
                  <img
                    src={att.preview || att.file_url}
                    alt={att.file_name || "Image"}
                    className="h-full w-full object-cover"
                  />
                  {att.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                  )}
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    disabled={disabled}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Documents — stacked */}
          {documentAttachments.map((att) => (
            <div
              key={att.id}
              className="relative flex items-center gap-3 rounded-lg border p-3"
            >
              <FileText className="h-8 w-8 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {att.file_name}
                </p>
                {att.file_size != null && att.file_size > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(att.file_size)}
                  </p>
                )}
              </div>
              {att.uploading && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              )}
              <button
                onClick={() => removeAttachment(att.id)}
                className="shrink-0 rounded-full p-1 hover:bg-muted"
                disabled={disabled}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptImages}
          multiple
          className="hidden"
          onChange={(e) => {
            handleFileUpload(e.target.files, "image");
            // Reset input so same file can be re-selected
            if (e.target) e.target.value = "";
          }}
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
          accept={acceptDocs}
          multiple
          className="hidden"
          onChange={(e) => {
            handleFileUpload(e.target.files, "document");
            if (e.target) e.target.value = "";
          }}
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
      </div>
    </div>
  );
}
