"use client";

import { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { X, ExternalLink, Loader2 } from "lucide-react";
import type { PostAttachment } from "@/types/database.types";

interface DocumentLightboxProps {
  doc: PostAttachment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * In-app modal for previewing document attachments. Two render paths:
 *
 *   - PDFs: iframe loads our proxy URL (`/api/drive-file/{id}`). The
 *     proxy serves `Content-Disposition: inline` for application/pdf,
 *     so Chrome's native PDF viewer renders inside with its full
 *     toolbar — page nav, zoom, search, download, print all available
 *     via the familiar Chromium UI.
 *
 *   - Non-PDFs (DOCX, XLSX, PPTX, TXT, CSV): iframe loads Drive's
 *     `https://drive.google.com/file/d/{id}/preview` URL. Drive's
 *     embedded viewer shows its own toolbar with download/print/etc.
 *     The upload pipeline domain-shares each file with mcrpathways.org
 *     so signed-in MCR users have access via their own Google identity.
 *
 * The modal itself adds NO toolbar of its own — that would duplicate
 * Chromium's PDF toolbar / Drive's preview header. Two floating buttons
 * sit on the dark backdrop top-right (matching image-lightbox.tsx
 * style): "Open in new tab" and "Close". Neither is provided by
 * Chromium PDF viewer or Drive preview, so no duplication.
 *
 * Backdrop click closes; ESC closes (Radix default).
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

          {/* Floating top-right controls on the backdrop. Stay outside
              the document panel so they don't visually compete with
              Chromium's / Drive's own chrome inside the iframe. */}
          <div className="absolute right-4 top-4 z-10 flex gap-2.5">
            <a
              href={newTabUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/20 bg-white/10 p-2.5 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
              aria-label="Open in new tab"
              title="Open in new tab"
            >
              <ExternalLink className="h-5 w-5" />
            </a>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full border border-white/20 bg-white/10 p-2.5 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
              aria-label="Close"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Key forces remount when the doc changes, resetting iframe + loading state */}
          <LightboxBody
            key={doc.id}
            iframeSrc={iframeSrc}
            filename={filename}
            isPdf={isPdf}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface LightboxBodyProps {
  iframeSrc: string;
  filename: string;
  isPdf: boolean;
}

function LightboxBody({ iframeSrc, filename, isPdf }: LightboxBodyProps) {
  const [loading, setLoading] = useState(true);

  // Defensive timeout: if the iframe's load event never fires (rare
  // network edge cases / cross-origin quirks), hide the spinner after 8s
  // so the user isn't stuck looking at a "Loading…" overlay.
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  const loadingLabel = isPdf ? "Loading PDF…" : "Loading document…";

  return (
    <div className="relative h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg bg-card shadow-2xl">
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
  );
}
