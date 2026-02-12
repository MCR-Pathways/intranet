"use client";

import { FileText, Download } from "lucide-react";
import { LinkPreviewCard } from "./link-preview-card";
import { sanitizeUrl, formatFileSize } from "@/lib/utils";
import type { PostAttachment } from "@/types/database.types";

interface AttachmentDisplayProps {
  attachments: PostAttachment[];
}

export function AttachmentDisplay({ attachments }: AttachmentDisplayProps) {
  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => a.attachment_type === "image");
  const documents = attachments.filter(
    (a) => a.attachment_type === "document"
  );
  const links = attachments.filter((a) => a.attachment_type === "link");

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
          {images.map((img) => (
            <a
              key={img.id}
              href={sanitizeUrl(img.file_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded dynamic image URLs */}
              <img
                src={img.file_url || undefined}
                alt={img.file_name || "Image"}
                className="w-full object-cover max-h-[400px] bg-muted"
              />
            </a>
          ))}
        </div>
      )}

      {/* Document links */}
      {documents.length > 0 && (
        <div className="space-y-1.5">
          {documents.map((doc) => (
            <a
              key={doc.id}
              href={sanitizeUrl(doc.file_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
            >
              <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {doc.file_name || "Document"}
                </p>
                {doc.file_size && (
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.file_size)}
                  </p>
                )}
              </div>
              <Download className="h-4 w-4 text-muted-foreground shrink-0" />
            </a>
          ))}
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
    </div>
  );
}
