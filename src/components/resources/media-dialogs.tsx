"use client";

/**
 * Upload and embed dialogs for media blocks in the native editor.
 *
 * ImageUploadDialog: file picker with progress, dimensions, retry.
 * VideoEmbedDialog: URL input with live preview.
 * FileUploadDialog: file picker with progress, retry.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
import { uploadEditorMedia } from "@/app/(protected)/resources/media-actions";
import { getEmbedUrl } from "@/lib/video";
import { formatFileSize } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

// =============================================
// IMAGE UPLOAD DIALOG
// =============================================

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
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retried, setRetried] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setFile(null);
      setUploading(false);
      setProgress(0);
      setError(null);
      setRetried(false);
      if (progressTimer.current) clearInterval(progressTimer.current);
    }
  }, [open]);

  const startProgress = useCallback(() => {
    setProgress(30);
    let current = 30;
    progressTimer.current = setInterval(() => {
      current = Math.min(current + 5, 85);
      setProgress(current);
    }, 500);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setProgress(100);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    startProgress();

    try {
      // Read dimensions before upload
      let width = 0;
      let height = 0;
      try {
        const bitmap = await createImageBitmap(file);
        width = bitmap.width;
        height = bitmap.height;
        bitmap.close();
      } catch {
        // Dimension read failed — proceed without
      }

      const fd = new FormData();
      fd.append("file", file);
      fd.append("articleId", articleId);

      const result = await uploadEditorMedia(fd);

      stopProgress();

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
      if (progressTimer.current) clearInterval(progressTimer.current);
    }
  }, [file, articleId, onInsert, onOpenChange, startProgress, stopProgress]);

  const handleRetry = useCallback(() => {
    setRetried(true);
    handleUpload();
  }, [handleUpload]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setError(null);
    setRetried(false);

    // Client-side validation
    const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!allowed.includes(selected.type)) {
      setError("Only PNG, JPEG, GIF, and WebP images are allowed");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("Image must be under 10 MB");
      return;
    }

    setFile(selected);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert image</DialogTitle>
          <DialogDescription>Upload a PNG, JPEG, GIF, or WebP image (max 10 MB)</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            ref={fileInputRef}
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

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
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
      if (!v) setUrl(defaultUrl ?? ""); // reset on close
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
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retried, setRetried] = useState(false);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setUploading(false);
      setProgress(0);
      setError(null);
      setRetried(false);
      if (progressTimer.current) clearInterval(progressTimer.current);
    }
  }, [open]);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setProgress(30);

    let current = 30;
    progressTimer.current = setInterval(() => {
      current = Math.min(current + 3, 85);
      setProgress(current);
    }, 500);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("articleId", articleId);

      const result = await uploadEditorMedia(fd);

      if (progressTimer.current) clearInterval(progressTimer.current);
      setProgress(100);

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
      if (progressTimer.current) clearInterval(progressTimer.current);
    }
  }, [file, articleId, onInsert, onOpenChange]);

  const handleRetry = useCallback(() => {
    setRetried(true);
    handleUpload();
  }, [handleUpload]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setError(null);
    setRetried(false);

    if (selected.size > 25 * 1024 * 1024) {
      setError("File must be under 25 MB");
      return;
    }

    setFile(selected);
  }, []);

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

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
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
