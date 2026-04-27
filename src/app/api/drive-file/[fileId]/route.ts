import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getDriveContentStream, DRIVE_FILE_ID_REGEX } from "@/lib/google-drive-upload";
import { logger } from "@/lib/logger";
import { rateLimiters, createRateLimitResponse, getClientIp } from "@/lib/ratelimit";

export const maxDuration = 60;

/**
 * GET /api/drive-file/[fileId]
 *
 * Authenticated streaming proxy for Google Drive files.
 * Only serves files registered in either the resource_media whitelist
 * (resources articles) or the post_attachments table (news-feed posts).
 * Metadata (mime_type, file_size, original_name) comes from the DB,
 * not from Drive — one API call instead of two.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;

  // 1. Auth check (session-scoped client)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorised" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 2. Rate limit (shares ogImage limiter — 50/min, sufficient for media)
  if (rateLimiters) {
    const ip = getClientIp(request);
    const { success, reset } = await rateLimiters.ogImage.limit(`drive:${ip}:${user.id}`);
    if (!success) return createRateLimitResponse(reset);
  }

  // 3. Validate file ID format
  if (!fileId || !DRIVE_FILE_ID_REGEX.test(fileId)) {
    return NextResponse.json(
      { error: "Invalid file ID" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 4. Whitelist check + metadata (service client — needs all rows regardless of uploader).
  // Two whitelist tables: resource_media (resources articles) and post_attachments
  // (news-feed posts). Run both in parallel — whichever returns the row wins.
  const service = createServiceClient();
  const [resourceRes, postRes] = await Promise.all([
    service
      .from("resource_media")
      .select("original_name, mime_type, file_size")
      .eq("file_id", fileId)
      .maybeSingle(),
    service
      .from("post_attachments")
      .select("file_name, mime_type, file_size")
      .eq("drive_file_id", fileId)
      .maybeSingle(),
  ]);

  const media: {
    name: string | null;
    mime_type: string | null;
    file_size: number | null;
  } | null = resourceRes.data
    ? {
        name: resourceRes.data.original_name,
        mime_type: resourceRes.data.mime_type,
        file_size: resourceRes.data.file_size,
      }
    : postRes.data
      ? {
          name: postRes.data.file_name,
          mime_type: postRes.data.mime_type,
          file_size: postRes.data.file_size,
        }
      : null;

  if (!media) {
    return NextResponse.json(
      { error: "File not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 5. Stream content from Google Drive (metadata already from DB)
  try {
    const file = await getDriveContentStream(fileId);

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Convert Node.js Readable to Web ReadableStream
    const webStream = Readable.toWeb(file.stream) as ReadableStream;

    // Content-Disposition: inline for images, attachment for files
    // Uses filename* with UTF-8 encoding for non-ASCII characters (RFC 6266)
    const mimeType = media.mime_type || "application/octet-stream";
    const isImage = mimeType.startsWith("image/");
    const rawName = media.name || "file";
    const disposition = isImage
      ? "inline"
      : `attachment; filename="${rawName.replace(/["\\\n\r\0]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(rawName)}`;

    return new Response(webStream, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": disposition,
        ...(media.file_size != null ? { "Content-Length": String(media.file_size) } : {}),
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    logger.error("Drive file proxy error", {
      error: err instanceof Error ? err.message : String(err),
      fileId,
    });
    return NextResponse.json(
      { error: "Failed to fetch file" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
