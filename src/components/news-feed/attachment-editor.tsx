"use client";

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import {
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
import {
  uploadPostAttachment,
  discardStagedAttachments,
} from "@/app/(protected)/intranet/actions";
import type { AttachmentType } from "@/types/database.types";

export interface PendingAttachment {
  id: string;
  type: AttachmentType;
  isExisting?: boolean;
  file_url?: string;
  drive_file_id?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  image_width?: number;
  image_height?: number;
  link_url?: string;
  link_title?: string;
  link_description?: string;
  link_image_url?: string;
  preview?: string;
  uploading?: boolean;
}

export interface AttachmentEditorHandle {
  triggerImageUpload: () => void;
  triggerDocumentUpload: () => void;
  /**
   * Process files dropped via drag-and-drop on a parent element. Auto-routes
   * based on the first file's MIME type. The parent owns the drag-zone area
   * (typically the whole dialog) so users can drop anywhere; this exposes the
   * upload pipeline as an imperative method.
   */
  handleDroppedFiles: (files: FileList) => void;
}

interface AttachmentEditorProps {
  initialAttachments?: PendingAttachment[];
  onChange: (attachments: PendingAttachment[]) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  /** When this value changes, internal state resets to initialAttachments */
  resetKey?: string | number;
}

export const AttachmentEditor = forwardRef<AttachmentEditorHandle, AttachmentEditorProps>(
  function AttachmentEditor({
    initialAttachments,
    onChange,
    onError,
    disabled,
    resetKey,
  }, ref) {
    const [attachments, setAttachments] = useState<PendingAttachment[]>(
      initialAttachments ?? []
    );
    const fileInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);

    // Expose trigger methods for external action bar + drag-and-drop bridge
    useImperativeHandle(ref, () => ({
      triggerImageUpload: () => fileInputRef.current?.click(),
      triggerDocumentUpload: () => docInputRef.current?.click(),
      handleDroppedFiles: (files: FileList) => {
        if (files.length === 0) return;
        const firstFile = files[0];
        const type = isImageType(firstFile.type) ? "image" : "document";
        handleFileUpload(files, type);
      },
    }));

    // Reset internal state when resetKey changes (intentional setState in effect for prop sync).
    // Only depend on resetKey — NOT initialAttachments — to avoid infinite loops
    // when the parent passes a new array reference on every render.
    useEffect(() => {
      setAttachments(initialAttachments ?? []);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resetKey]);

    // Notify parent whenever attachments change
    useEffect(() => {
      onChange(attachments);
    }, [attachments, onChange]);

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

        // Validate all files first, then upload in parallel
        const validFiles: { file: File; tempId: string; preview?: string }[] = [];
        for (const file of filesToUpload) {
          const validationError = validateFile(file);
          if (validationError) {
            onError?.(validationError);
            continue;
          }
          validFiles.push({
            file,
            tempId: crypto.randomUUID(),
            preview: type === "image" ? URL.createObjectURL(file) : undefined,
          });
        }

        if (validFiles.length === 0) return;

        // Add all placeholders at once (single state update)
        setAttachments((prev) => [
          ...prev,
          ...validFiles.map(({ tempId, file, preview }) => ({
            id: tempId,
            type,
            file_name: file.name,
            file_size: file.size,
            preview,
            uploading: true,
          })),
        ]);

        // Upload all files in parallel
        await Promise.all(
          validFiles.map(async ({ file, tempId }) => {
            const formData = new FormData();
            formData.append("file", file);

            const result = await uploadPostAttachment(formData);

            if (result.success && result.url) {
              setAttachments((prev) =>
                prev.map((a) => {
                  if (a.id !== tempId) return a;
                  // Release the blob URL and switch to the server URL.
                  // Critical for HEIC: browsers can't render HEIC blobs, so
                  // the local preview shows a broken icon. The server-side
                  // pipeline converted to JPEG, which file_url now points at.
                  if (a.preview) URL.revokeObjectURL(a.preview);
                  return {
                    ...a,
                    preview: undefined,
                    file_url: result.url,
                    drive_file_id: result.driveFileId,
                    file_name: result.fileName,
                    file_size: result.fileSize,
                    mime_type: result.mimeType,
                    image_width: result.width ?? undefined,
                    image_height: result.height ?? undefined,
                    uploading: false,
                  };
                })
              );
            } else {
              setAttachments((prev) => prev.filter((a) => a.id !== tempId));
              onError?.(result.error ?? "Upload failed");
            }
          })
        );
      },
      [attachments.length, onError]
    );

    const removeAttachment = useCallback((id: string) => {
      let stagedDriveId: string | undefined;
      setAttachments((prev) => {
        const att = prev.find((a) => a.id === id);
        if (att?.preview) URL.revokeObjectURL(att.preview);
        // Only discard the Drive file for NEW (staged) uploads. Existing
        // attachments from edit-flow point at post_attachments rows; they
        // get cleaned up server-side when editPost runs.
        if (att && !att.isExisting && att.drive_file_id) {
          stagedDriveId = att.drive_file_id;
        }
        return prev.filter((a) => a.id !== id);
      });
      // Fire-and-forget Drive cleanup. Failures are logged server-side and
      // swept by the daily cron — don't block UI.
      if (stagedDriveId) {
        void discardStagedAttachments([stagedDriveId]).catch(() => {
          // best-effort
        });
      }
    }, []);

    // Drag-and-drop is owned by the parent dialog (see useDialogDropZone).
    // Files dropped on the dialog flow back via the imperative
    // handleDroppedFiles handle exposed above.

    // ─── Derived values ────────────────────────────────────────────────

    const imageAttachments = attachments.filter((a) => a.type === "image");
    const documentAttachments = attachments.filter(
      (a) => a.type === "document"
    );

    const acceptImages = ALLOWED_IMAGE_TYPES.join(",");
    const acceptDocs = ALLOWED_DOCUMENT_TYPES.join(",");

    return (
      <div className="space-y-3">
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

        {/* Hidden file inputs — triggered via imperative handle from ComposerActionBar */}
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptImages}
          multiple
          className="hidden"
          onChange={(e) => {
            handleFileUpload(e.target.files, "image");
            if (e.target) e.target.value = "";
          }}
        />
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
      </div>
    );
  }
);
