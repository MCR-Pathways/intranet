"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { LinkPreviewCard } from "./link-preview-card";
import { ImageLightbox } from "./image-lightbox";
import { DocumentLightbox } from "./document-lightbox";
import { formatFileSize, cn } from "@/lib/utils";
import { resolveFileType } from "@/lib/file-types";
import type { PostAttachment } from "@/types/database.types";

interface AttachmentDisplayProps {
  attachments: PostAttachment[];
}

export function AttachmentDisplay({ attachments }: AttachmentDisplayProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxDoc, setLightboxDoc] = useState<PostAttachment | null>(null);

  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => a.attachment_type === "image");
  const documents = attachments.filter(
    (a) => a.attachment_type === "document"
  );
  const links = attachments.filter((a) => a.attachment_type === "link");

  const handleImageClick = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="space-y-3">
      {/* Image gallery */}
      {images.length > 0 && (
        <div
          className={
            images.length === 1
              ? "rounded-lg overflow-hidden"
              : "grid grid-cols-2 gap-1 rounded-lg overflow-hidden"
          }
        >
          {images.map((img, index) => (
            <button
              key={img.id}
              type="button"
              onClick={() => handleImageClick(index)}
              className="block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded dynamic image URLs */}
              <img
                src={img.file_url || undefined}
                alt={img.file_name || "Image"}
                className="w-full object-cover max-h-[400px] bg-muted"
                // width + height attrs let the browser compute aspect-ratio
                // and reserve space, preventing layout shift while the image
                // streams in. CSS w-full overrides the rendered width.
                {...(img.image_width && img.image_height
                  ? { width: img.image_width, height: img.image_height }
                  : {})}
              />
            </button>
          ))}
        </div>
      )}

      {/* Document links — clickable card opens the lightbox; download is
          a sibling anchor with download={filename} so the same proxy URL
          serves preview (Content-Disposition: inline for PDFs, Drive
          /preview iframe for non-PDFs) and download (download attr beats
          Content-Disposition: inline on Chrome/Firefox 82+). */}
      {documents.length > 0 && (
        <div className="space-y-1.5">
          {documents.map((doc) => {
            const fileType = resolveFileType(doc.mime_type, doc.file_name);
            const FileIcon = fileType.Icon;
            const meta = [
              fileType.label,
              doc.page_count != null
                ? `${doc.page_count} ${doc.page_count === 1 ? "page" : "pages"}`
                : null,
              doc.file_size ? formatFileSize(doc.file_size) : null,
            ]
              .filter(Boolean)
              .join(" · ");
            const filename = doc.file_name || "document";
            return (
              <div key={doc.id} className="relative">
                <button
                  type="button"
                  onClick={() => setLightboxDoc(doc)}
                  className="w-full flex items-center gap-3 rounded-lg border border-border p-3 pr-12 hover:bg-muted/50 transition-colors text-left"
                >
                  <div
                    className={cn(
                      "h-10 w-10 rounded-md flex items-center justify-center shrink-0",
                      fileType.bgClass,
                    )}
                  >
                    <FileIcon className={cn("h-5 w-5", fileType.fgClass)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{filename}</p>
                    <p className="text-xs text-muted-foreground">{meta}</p>
                  </div>
                </button>
                <a
                  // Same-origin proxy path; safe without sanitizeUrl (which
                  // strips relative URLs). Falls back to undefined (inert
                  // anchor) rather than "#" so a missing file_url doesn't
                  // jump the page to top on click.
                  href={doc.file_url ?? undefined}
                  download={filename}
                  aria-label={`Download ${filename}`}
                  title="Download"
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* Link previews */}
      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((link) => (
            <LinkPreviewCard
              key={link.id}
              url={link.link_url || ""}
              title={link.link_title}
              description={link.link_description}
              imageUrl={link.link_image_url}
            />
          ))}
        </div>
      )}

      {/* Image Lightbox */}
      {images.length > 0 && (
        <ImageLightbox
          images={images}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      )}

      {/* Document Lightbox */}
      <DocumentLightbox
        doc={lightboxDoc}
        open={lightboxDoc !== null}
        onOpenChange={(open) => {
          if (!open) setLightboxDoc(null);
        }}
      />
    </div>
  );
}
