import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getDriveFileStream, DRIVE_FILE_ID_REGEX } from "@/lib/google-drive-upload";
import { logger } from "@/lib/logger";
import { rateLimiters, createRateLimitResponse, getClientIp } from "@/lib/ratelimit";

export const maxDuration = 60;

/**
 * GET /api/drive-file/[fileId]
 *
 * Authenticated streaming proxy for Google Drive files.
 * Only serves files registered in the resource_media whitelist table.
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

  // 2. Rate limit
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

  // 4. Whitelist check (service client — needs all rows regardless of uploader)
  const service = createServiceClient();
  const { data: media } = await service
    .from("resource_media")
    .select("file_id, original_name")
    .eq("file_id", fileId)
    .limit(1)
    .single();

  if (!media) {
    return NextResponse.json(
      { error: "File not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 5. Stream from Google Drive
  try {
    const file = await getDriveFileStream(fileId);

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Convert Node.js Readable to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        file.stream.on("data", (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        file.stream.on("end", () => {
          controller.close();
        });
        file.stream.on("error", (err) => {
          controller.error(err);
        });
      },
    });

    // Content-Disposition: inline for images, attachment for files
    const isImage = file.mimeType.startsWith("image/");
    const safeName = (media.original_name || file.name).replace(/["\\\n\r\0]/g, "_");
    const disposition = isImage
      ? "inline"
      : `attachment; filename="${safeName}"`;

    return new Response(webStream, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": disposition,
        "Content-Length": String(file.size),
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
