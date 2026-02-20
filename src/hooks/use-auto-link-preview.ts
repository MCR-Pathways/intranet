"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { extractUrls } from "@/lib/url";
import { fetchLinkPreview } from "@/app/(protected)/intranet/actions";

export interface AutoLinkPreview {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
}

interface UseAutoLinkPreviewOptions {
  content: string;
  /** Only run detection when true (default: true). Use for edit dialog open/close. */
  enabled?: boolean;
  /** Pre-populate preview from existing data (e.g. existing link attachment on edit). */
  initialPreview?: AutoLinkPreview | null;
}

interface UseAutoLinkPreviewResult {
  autoLinkPreview: AutoLinkPreview | null;
  isFetchingPreview: boolean;
  dismissPreview: () => void;
  /** Reset all state — call on submit or dialog close. */
  resetPreview: (newInitialPreview?: AutoLinkPreview | null) => void;
}

export function useAutoLinkPreview({
  content,
  enabled = true,
  initialPreview = null,
}: UseAutoLinkPreviewOptions): UseAutoLinkPreviewResult {
  const [autoLinkPreview, setAutoLinkPreview] =
    useState<AutoLinkPreview | null>(initialPreview);
  const [dismissedLinkUrl, setDismissedLinkUrl] = useState<string | null>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const fetchAbortRef = useRef<AbortController | null>(null);

  // Debounced auto-link detection
  useEffect(() => {
    if (!enabled) return;

    const urls = extractUrls(content);
    const firstUrl = urls[0] ?? null;

    // No URL found or URL was dismissed
    if (!firstUrl || firstUrl === dismissedLinkUrl) {
      if (autoLinkPreview && (!firstUrl || firstUrl !== autoLinkPreview.url)) {
        setAutoLinkPreview(null);
      }
      return;
    }

    // Already showing preview for this URL
    if (autoLinkPreview?.url === firstUrl) return;

    const timer = setTimeout(async () => {
      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      setIsFetchingPreview(true);
      const result = await fetchLinkPreview(firstUrl);

      if (controller.signal.aborted) return;
      setIsFetchingPreview(false);

      if (result.success) {
        setAutoLinkPreview({
          url: firstUrl,
          title: result.title,
          description: result.description,
          imageUrl: result.imageUrl,
        });
      } else {
        setAutoLinkPreview(null);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, dismissedLinkUrl, enabled]);

  // Abort in-flight fetch on unmount
  useEffect(() => {
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, []);

  const dismissPreview = useCallback(() => {
    if (autoLinkPreview) {
      setDismissedLinkUrl(autoLinkPreview.url);
      setAutoLinkPreview(null);
    }
  }, [autoLinkPreview]);

  const resetPreview = useCallback(
    (newInitialPreview?: AutoLinkPreview | null) => {
      setAutoLinkPreview(newInitialPreview ?? null);
      setDismissedLinkUrl(null);
      setIsFetchingPreview(false);
      fetchAbortRef.current?.abort();
    },
    []
  );

  return { autoLinkPreview, isFetchingPreview, dismissPreview, resetPreview };
}
