import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncDocumentContent } from "@/lib/google-drive";
import { timingSafeTokenCompare } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

/**
 * Google Drive push notification webhook.
 *
 * When a watched Google Doc changes, Google sends a POST notification here.
 * We look up the article by Google Doc ID and re-sync the content.
 *
 * Headers from Google:
 * - X-Goog-Channel-ID: channel ID we set during watch registration
 * - X-Goog-Channel-Token: our verification token
 * - X-Goog-Resource-State: "sync" (initial), "exists" (change), "not_exists" (deleted)
 * - X-Goog-Resource-ID: the Drive resource ID
 *
 * Security: validated via GOOGLE_DRIVE_WEBHOOK_SECRET in the channel token.
 */
export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.GOOGLE_DRIVE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error("GOOGLE_DRIVE_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }

    // Extract Google push notification headers
    const channelToken = request.headers.get("x-goog-channel-token");
    const resourceState = request.headers.get("x-goog-resource-state");
    const channelId = request.headers.get("x-goog-channel-id");

    if (!channelToken) {
      return NextResponse.json(
        { error: "Missing channel token" },
        { status: 400 }
      );
    }

    // Channel token format: "secret:googleDocId"
    const colonIndex = channelToken.indexOf(":");
    if (colonIndex === -1) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const secret = channelToken.substring(0, colonIndex);
    const googleDocId = channelToken.substring(colonIndex + 1);

    if (!secret || !googleDocId || !timingSafeTokenCompare(secret, webhookSecret)) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    // Initial sync notification — acknowledge only
    if (resourceState === "sync") {
      logger.info("Drive webhook sync confirmation", { channelId, googleDocId });
      return NextResponse.json({ ok: true });
    }

    // Only process "exists" (resource changed) notifications
    if (resourceState !== "exists") {
      return NextResponse.json({ ok: true });
    }

    // Look up article by Google Doc ID
    const supabase = createServiceClient();
    const { data: article } = await supabase
      .from("resource_articles")
      .select("id, slug, google_doc_id")
      .eq("google_doc_id", googleDocId)
      .eq("content_type", "google_doc")
      .single();

    if (!article) {
      // Doc may have been unlinked — no action needed
      logger.info("Drive webhook: no article found for doc", { googleDocId });
      return NextResponse.json({ ok: true });
    }

    // Re-sync content from Google Docs
    const { html, plaintext } = await syncDocumentContent(googleDocId);

    // Update the article with fresh content
    const { error: updateError } = await supabase
      .from("resource_articles")
      .update({
        synced_html: html,
        content: plaintext,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", article.id);

    if (updateError) {
      logger.error("Drive webhook: failed to update article", {
        articleId: article.id,
        error: updateError.message,
      });
      // Return 200 anyway — Google retries on non-2xx
      return NextResponse.json({ ok: true });
    }

    // Revalidate the article page so next visitor gets fresh content
    revalidatePath(`/resources/article/${article.slug}`);
    revalidatePath("/resources", "layout");

    logger.info("Drive webhook: article synced successfully", {
      articleId: article.id,
      googleDocId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Drive webhook error", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Return 200 to avoid Google retries on transient errors
    return NextResponse.json({ ok: true });
  }
}
