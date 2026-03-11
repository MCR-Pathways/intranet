import { type ReactNode, createElement } from "react";
import { sanitizeUrl } from "@/lib/utils";

/**
 * If an image URL is an external http(s) URL, proxy it through /api/og-image
 * so it satisfies CSP img-src 'self'. Already-proxied relative paths (but not
 * protocol-relative URLs like //attacker.com) are returned as-is.
 */
export function proxyImageUrl(
  raw: string | null | undefined
): string | undefined {
  if (!raw) return undefined;
  // Already a relative proxy path (new posts) — exclude protocol-relative URLs
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  // External URL (including protocol-relative) — proxy it
  if (/^(\/\/|https?:\/\/)/i.test(raw)) {
    const urlToProxy = raw.startsWith("//") ? `https:${raw}` : raw;
    return `/api/og-image?url=${encodeURIComponent(urlToProxy)}`;
  }
  return undefined;
}

/**
 * Sanitise a redirect path from a query parameter (e.g. `?next=/dashboard`).
 * Rejects protocol-relative URLs (`//evil.com`) and absolute URLs that could
 * cause open redirects. Returns the fallback if the path is unsafe.
 */
export function sanitizeRedirectPath(
  raw: string,
  fallback = "/intranet"
): string {
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

/** Validate that a URL uses http(s) protocol (case-insensitive per RFC 3986). */
export function isValidHttpUrl(url: string): boolean {
  const trimmed = url.trim();
  return !!trimmed && /^https?:\/\//i.test(trimmed);
}

/**
 * Regex for detecting URLs with explicit http(s) protocol.
 * Conservative: requires protocol prefix to avoid false positives.
 * Trailing character class excludes common sentence-ending punctuation.
 */
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;

/** Strip common trailing sentence punctuation from a URL match. */
function cleanUrlMatch(url: string): string {
  return url.replace(/[.,;:!?]+$/, "");
}

/**
 * Extract all URLs from a text string.
 * Returns array of unique, validated URL strings.
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];

  const seen = new Set<string>();
  return matches.reduce<string[]>((acc, rawUrl) => {
    const url = cleanUrlMatch(rawUrl);
    const safe = sanitizeUrl(url);
    if (!safe || seen.has(safe)) return acc;
    seen.add(safe);
    acc.push(safe);
    return acc;
  }, []);
}

/**
 * Linkify text content: replace URLs with clickable <a> elements.
 * Returns an array of React nodes (strings and <a> elements).
 * XSS-safe: uses createElement, not dangerouslySetInnerHTML.
 */
export function linkifyText(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  const regex = new RegExp(URL_REGEX.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const rawUrl = match[0];
    const url = cleanUrlMatch(rawUrl);
    const safe = sanitizeUrl(url);

    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (safe) {
      parts.push(
        createElement(
          "a",
          {
            key: `link-${match.index}`,
            href: safe,
            target: "_blank",
            rel: "noopener noreferrer",
            className:
              "text-primary underline hover:text-primary/80 break-all",
          },
          url
        )
      );
    } else {
      // Invalid URL, keep as plain text
      parts.push(url);
    }

    // Only advance past the cleaned URL, leaving stripped punctuation for next segment
    lastIndex = match.index + url.length;
  }

  // Add remaining text after last URL
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
