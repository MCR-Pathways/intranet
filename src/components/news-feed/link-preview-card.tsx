"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { sanitizeUrl } from "@/lib/utils";

/**
 * If an image URL is an external http(s) URL, proxy it through /api/og-image
 * so it satisfies CSP img-src 'self'. Already-proxied relative paths and
 * same-origin URLs are returned as-is.
 */
function proxyImageUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  // Already a relative proxy path (new posts)
  if (raw.startsWith("/")) return raw;
  // External URL — proxy it (handles old posts stored with raw OG URLs)
  if (/^https?:\/\//i.test(raw)) {
    return `/api/og-image?url=${encodeURIComponent(raw)}`;
  }
  return undefined;
}

interface LinkPreviewCardProps {
  url: string;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  /** "default" = full-width vertical (feed posts), "compact" = horizontal thumbnail (composers) */
  variant?: "default" | "compact";
}

export function LinkPreviewCard({
  url,
  title,
  description,
  imageUrl,
  variant = "default",
}: LinkPreviewCardProps) {
  const [imgError, setImgError] = useState(false);
  const proxiedImageUrl = useMemo(() => proxyImageUrl(imageUrl), [imageUrl]);
  const safeHref = sanitizeUrl(url) || "#";
  let displayHostname = url;
  try {
    displayHostname = new URL(url).hostname;
  } catch {
    /* keep raw url as fallback */
  }

  if (variant === "compact") {
    return (
      <a
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex overflow-hidden rounded-lg border border-border hover:bg-muted/50 transition-colors"
      >
        {proxiedImageUrl && !imgError ? (
          <div className="h-20 w-20 shrink-0 overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- proxied OG image */}
            <img
              src={proxiedImageUrl}
              alt={title || "Link preview"}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center bg-muted">
            <ExternalLink className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center p-3">
          {title && (
            <p className="font-medium text-sm line-clamp-1">{title}</p>
          )}
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {description}
            </p>
          )}
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{displayHostname}</span>
          </div>
        </div>
      </a>
    );
  }

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-lg border border-border hover:bg-muted/50 transition-colors"
    >
      {proxiedImageUrl && !imgError && (
        <div className="aspect-video w-full overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- proxied OG image */}
          <img
            src={proxiedImageUrl}
            alt={title || "Link preview"}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
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
            {displayHostname}
          </span>
        </div>
      </div>
    </a>
  );
}
