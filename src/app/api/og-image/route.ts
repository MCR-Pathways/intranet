import { NextRequest, NextResponse } from "next/server";
import { resolveExternalUrl } from "@/lib/ssrf";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const FETCH_TIMEOUT_MS = 5000;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Validate protocol
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
  }

  // SSRF protection
  const resolvedIp = await resolveExternalUrl(url);
  if (!resolvedIp) {
    return NextResponse.json({ error: "Blocked URL" }, { status: 403 });
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "MCR-Intranet-Bot/1.0" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 400 });
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
