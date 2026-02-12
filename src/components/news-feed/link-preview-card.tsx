"use client";

import { ExternalLink } from "lucide-react";

interface LinkPreviewCardProps {
  url: string;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}

export function LinkPreviewCard({
  url,
  title,
  description,
  imageUrl,
}: LinkPreviewCardProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-lg border border-border hover:bg-muted/50 transition-colors"
    >
      {imageUrl && (
        <div className="aspect-video w-full overflow-hidden bg-muted">
          <img
            src={imageUrl}
            alt={title || "Link preview"}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="p-3">
        {title && (
          <p className="font-medium text-sm line-clamp-2">{title}</p>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {description}
          </p>
        )}
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          <span className="truncate">
            {new URL(url).hostname}
          </span>
        </div>
      </div>
    </a>
  );
}
