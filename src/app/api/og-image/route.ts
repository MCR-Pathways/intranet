import { NextRequest, NextResponse } from "next/server";
import { resolveExternalUrl } from "@/lib/ssrf";
import { createClient } from "@/lib/supabase/server";
import { rateLimiters, createRateLimitResponse, getClientIp } from "@/lib/ratelimit";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

const SAFE_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
];

export async function GET(request: NextRequest) {
  // Auth check — only logged-in users can use this proxy
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Rate limit by IP + user ID — prevents SSRF abuse
  if (rateLimiters) {
    const ip = getClientIp(request);
    const { success, reset } = await rateLimiters.ogImage.limit(`${ip}:${user.id}`);
    if (!success) return createRateLimitResponse(reset);
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Validate protocol
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    // Manual redirect handling with SSRF validation on each hop
    let currentUrl = url;
    let response: Response | null = null;

    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const resolvedIp = await resolveExternalUrl(currentUrl);
      if (!resolvedIp) {
        return NextResponse.json({ error: "Blocked URL" }, { status: 403 });
      }

      response = await fetch(currentUrl, {
        headers: { "User-Agent": "MCR-Intranet-Bot/1.0" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "manual",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || i === MAX_REDIRECTS) {
          return NextResponse.json({ error: "Too many redirects" }, { status: 502 });
        }
        currentUrl = new URL(location, currentUrl).toString();
        const redirectParsed = new URL(currentUrl);
        if (redirectParsed.protocol !== "http:" && redirectParsed.protocol !== "https:") {
          return NextResponse.json({ error: "Invalid redirect protocol" }, { status: 400 });
        }
        continue;
      }

      break;
    }

    if (!response?.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }

    // Block SVG (can contain scripts) and only allow safe raster image types
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "";
    if (!SAFE_IMAGE_TYPES.includes(contentType)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }

    // Read with size limit
    const reader = response.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: "No body" }, { status: 502 });
    }

    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    let result: ReadableStreamReadResult<Uint8Array>;
    while (!(result = await reader.read()).done) {
      totalSize += result.value.byteLength;
      if (totalSize > MAX_IMAGE_BYTES) {
        reader.cancel();
        return NextResponse.json({ error: "Image too large" }, { status: 413 });
      }
      chunks.push(result.value);
    }

    const body = Buffer.concat(chunks);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Content-Length": String(body.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
