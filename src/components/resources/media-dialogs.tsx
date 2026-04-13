"use client";

/**
 * Upload and embed dialogs for media blocks in the native editor.
 *
 * ImageUploadDialog: file picker with progress, dimensions, retry.
 * VideoEmbedDialog: URL input with live preview.
 * FileUploadDialog: file picker with progress, retry.
 *
 * Image and file dialogs share upload state via useUploadHandler.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useUploadHandler } from "@/hooks/use-upload-handler";
import { uploadEditorMedia } from "@/app/(protected)/resources/media-actions";
import { getEmbedUrl } from "@/lib/video";
import { formatFileSize } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

// =============================================
// IMAGE UPLOAD DIALOG
// =============================================

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

function validateImageType(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) {
    return "Only PNG, JPEG, GIF, and WebP images are allowed";
  }
  return null;
}

interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: string;
  onInsert: (url: string, width: number, height: number) => void;
}

export function ImageUploadDialog({
  open,
  onOpenChange,
  articleId,
  onInsert,
}: ImageUploadDialogProps) {
  const {
    file, uploading, setUploading, progress, error, setError,
    retried, setRetried, handleFileChange, startProgress, stopProgress, reset,
  } = useUploadHandler(MAX_IMAGE_SIZE, validateImageType);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    startProgress();

    try {
      let width = 0;
      let height = 0;
      try {
        const bitmap = await createImageBitmap(file);
        width = bitmap.width;
        height = bitmap.height;
        bitmap.close();
      } catch {
        // Proceed without dimensions
      }

      const fd = new FormData();
      fd.append("file", file);
      fd.append("articleId", articleId);

      const result = await uploadEditorMedia(fd);

      if (!result.success) {
        setError(result.error ?? "Upload failed");
        return;
      }

      onInsert(result.url!, width, height);
      onOpenChange(false);
    } catch {
      setError("Upload failed — check your connection");
    } finally {
      setUploading(false);
      stopProgress();
    }
  }, [file, setUploading, setError, startProgress, stopProgress, articleId, onInsert, onOpenChange]);

  const handleRetry = useCallback(() => {
    setRetried(true);
    handleUpload();
  }, [setRetried, handleUpload]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert image</DialogTitle>
          <DialogDescription>Upload a PNG, JPEG, GIF, or WebP image (max 10 MB)</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={handleFileChange}
            disabled={uploading}
          />

          {file && !error && (
            <p className="text-sm text-muted-foreground">
              {file.name} ({formatFileSize(file.size)})
              {file.size > 8 * 1024 * 1024 && (
                <span className="ml-2 text-amber-600">
                  <AlertTriangle className="inline h-3.5 w-3.5 mr-0.5" />
                  Large file — upload may take a moment
                </span>
              )}
            </p>
          )}

          {uploading && <Progress value={progress} className="h-2" />}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          {error && !retried && (
            <Button variant="outline" onClick={handleRetry} disabled={uploading}>
              Retry
            </Button>
          )}
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Uploading..." : "Insert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// VIDEO EMBED DIALOG
// =============================================

interface VideoEmbedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultUrl?: string;
  onEmbed: (embedUrl: string, sourceUrl: string) => void;
}

export function VideoEmbedDialog({
  open,
  onOpenChange,
  defaultUrl,
  onEmbed,
}: VideoEmbedDialogProps) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const embedUrl = url ? getEmbedUrl(url) : "";

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) setUrl(defaultUrl ?? "");
      onOpenChange(v);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Embed video</DialogTitle>
          <DialogDescription>Paste a YouTube or Vimeo URL</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />

          {embedUrl && (
            <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingBottom: "56.25%" }}>
              <iframe
                src={embedUrl}
                title="Video preview"
                className="absolute inset-0 w-full h-full"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                allowFullScreen
              />
            </div>
          )}

          {url && !embedUrl && (
            <p className="text-sm text-destructive">Only YouTube and Vimeo URLs are supported</p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => {
              onEmbed(embedUrl, url);
              onOpenChange(false);
            }}
            disabled={!embedUrl}
          >
            Embed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// FILE UPLOAD DIALOG
// =============================================

const MAX_FILE_SIZE = 25 * 1024 * 1024;

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: string;
  onInsert: (url: string, name: string, size: number) => void;
}

export function FileUploadDialog({
  open,
  onOpenChange,
  articleId,
  onInsert,
}: FileUploadDialogProps) {
  const {
    file, uploading, setUploading, progress, error, setError,
    retried, setRetried, handleFileChange, startProgress, stopProgress, reset,
  } = useUploadHandler(MAX_FILE_SIZE);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    startProgress();

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("articleId", articleId);

      const result = await uploadEditorMedia(fd);

      if (!result.success) {
        setError(result.error ?? "Upload failed");
        return;
      }

      onInsert(result.url!, result.fileName ?? file.name, result.fileSize ?? file.size);
      onOpenChange(false);
    } catch {
      setError("Upload failed — check your connection");
    } finally {
      setUploading(false);
      stopProgress();
    }
  }, [file, setUploading, setError, startProgress, stopProgress, articleId, onInsert, onOpenChange]);

  const handleRetry = useCallback(() => {
    setRetried(true);
    handleUpload();
  }, [setRetried, handleUpload]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Attach file</DialogTitle>
          <DialogDescription>Upload a PDF, Word, Excel, PowerPoint, or text file (max 25 MB)</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
            onChange={handleFileChange}
            disabled={uploading}
          />

          {file && !error && (
            <p className="text-sm text-muted-foreground">
              {file.name} ({formatFileSize(file.size)})
              {file.size > 20 * 1024 * 1024 && (
                <span className="ml-2 text-amber-600">
                  <AlertTriangle className="inline h-3.5 w-3.5 mr-0.5" />
                  Large file — upload may take a moment
                </span>
              )}
            </p>
          )}

          {uploading && <Progress value={progress} className="h-2" />}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          {error && !retried && (
            <Button variant="outline" onClick={handleRetry} disabled={uploading}>
              Retry
            </Button>
          )}
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Uploading..." : "Attach"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
