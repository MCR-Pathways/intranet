"use client";

import { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { X, Download, ExternalLink, Loader2 } from "lucide-react";
import type { PostAttachment } from "@/types/database.types";
import { resolveFileType } from "@/lib/file-types";

interface DocumentLightboxProps {
  doc: PostAttachment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * In-app modal for previewing document attachments. Two render paths:
 *
 *   - PDFs: iframe loads our proxy URL (`/api/drive-file/{id}`) which serves
 *     `Content-Disposition: inline` for application/pdf. Browser's native
 *     PDF viewer renders inside the iframe (page nav, zoom, search, print
 *     all available via the viewer's own toolbar).
 *
 *   - Non-PDFs (DOCX, XLSX, PPTX, TXT, CSV): iframe loads Drive's
 *     `https://drive.google.com/file/d/{id}/preview` URL. The upload
 *     pipeline domain-shares each file with mcrpathways.org so signed-in
 *     MCR users have access via their own Google identity.
 *
 * Mirrors image-lightbox.tsx structure: DialogPrimitive directly, no
 * styled Dialog wrapper. Backdrop click closes; ESC closes.
 */
export function DocumentLightbox({
  doc,
  open,
  onOpenChange,
}: DocumentLightboxProps) {
  if (!doc) return null;

  const isPdf = doc.mime_type === "application/pdf";
  const filename = doc.file_name || "document";
  const proxyUrl = doc.file_url ?? "";
  const driveFileId = doc.drive_file_id ?? "";

  const iframeSrc = isPdf
    ? proxyUrl
    : `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/preview`;

  const newTabUrl = isPdf
    ? proxyUrl
    : `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/view`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
          aria-describedby={undefined}
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <VisuallyHidden.Root>
            <DialogPrimitive.Title>{filename}</DialogPrimitive.Title>
          </VisuallyHidden.Root>

          {/* Key forces remount when the doc changes, resetting iframe + loading state */}
          <LightboxBody
            key={doc.id}
            iframeSrc={iframeSrc}
            newTabUrl={newTabUrl}
            downloadUrl={proxyUrl}
            filename={filename}
            mimeType={doc.mime_type}
            pageCount={doc.page_count}
            isPdf={isPdf}
            onClose={() => onOpenChange(false)}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface LightboxBodyProps {
  iframeSrc: string;
  newTabUrl: string;
  downloadUrl: string;
  filename: string;
  mimeType: string | null;
  pageCount: number | null;
  isPdf: boolean;
  onClose: () => void;
}

function LightboxBody({
  iframeSrc,
  newTabUrl,
  downloadUrl,
  filename,
  mimeType,
  pageCount,
  isPdf,
  onClose,
}: LightboxBodyProps) {
  const [loading, setLoading] = useState(true);
  const fileType = resolveFileType(mimeType, filename);

  // Defensive timeout: if the iframe's load event never fires (rare network
  // edge cases / cross-origin quirks), hide the spinner after 8s so the
  // user isn't stuck looking at a "Loading…" overlay.
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  const downloadFilename = filename.includes(".")
    ? filename
    : `${filename}.${fileType.label.toLowerCase()}`;

  const loadingLabel = isPdf ? "Loading PDF…" : "Loading document…";

  return (
    <div className="bg-card rounded-lg shadow-2xl overflow-hidden w-full max-w-5xl h-[90vh] flex flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" title={filename}>
            {filename}
          </p>
          {pageCount != null && (
            <p className="text-xs text-muted-foreground">
              {pageCount} {pageCount === 1 ? "page" : "pages"}
            </p>
          )}
        </div>

        <a
          href={newTabUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Open in new tab"
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </a>

        <a
          href={downloadUrl}
          download={downloadFilename}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={`Download ${filename}`}
          title="Download"
        >
          <Download className="h-4 w-4" />
        </a>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex-1 bg-muted">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingLabel}
          </div>
        )}
        <iframe
          src={iframeSrc}
          title={filename}
          className="absolute inset-0 h-full w-full border-0"
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
}
