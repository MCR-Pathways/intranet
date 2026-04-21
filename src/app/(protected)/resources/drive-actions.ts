"use server";

/**
 * Server actions for Google Drive integration with Resources module.
 *
 * Handles folder registration, document listing, linking/unlinking
 * Google Docs to resource articles, and manual sync triggers.
 *
 * All mutations require Content Editor permission via requireContentEditor().
 */

import { revalidatePath } from "next/cache";
import { requireContentEditor } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  extractDocId,
  extractFolderId,
  listFolderDocuments,
  getDocumentMetadata,
  syncDocumentContent,
  watchFile,
  stopWatchChannel,
} from "@/lib/google-drive";
import { logger } from "@/lib/logger";
import { indexArticleSections, removeArticleFromIndex } from "@/lib/algolia";
import { parseHtmlIntoSections } from "@/lib/html-sections";

// =============================================
// CONSTANTS
// =============================================

const MAX_TITLE_LENGTH = 200;
const RESERVED_SLUGS = new Set(["new", "edit", "bin", "settings", "article"]);

// =============================================
// HELPERS
// =============================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureUniqueArticleSlug(
  supabase: ReturnType<typeof createServiceClient>,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;

  // Avoid reserved slugs
  while (RESERVED_SLUGS.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  // Check uniqueness (including soft-deleted for safety)
  while (true) {
    const { data } = await supabase
      .from("resource_articles")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (!data || data.length === 0) break;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  return slug;
}

function revalidate() {
  revalidatePath("/resources", "layout");
}

// =============================================
// FOLDER REGISTRATION
// =============================================

/**
 * Register a Google Drive folder for browsing documents.
 */
export async function registerDriveFolder(
  folderUrl: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireContentEditor();

    // Validate inputs
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > MAX_TITLE_LENGTH) {
      return { success: false, error: "Please provide a valid folder name" };
    }

    const folderId = extractFolderId(folderUrl);
    if (!folderId) {
      return {
        success: false,
        error: "Invalid Google Drive folder URL. Expected format: https://drive.google.com/drive/folders/...",
      };
    }

    // Check if folder is already registered
    const { data: existing } = await supabase
      .from("drive_folders")
      .select("id")
      .eq("folder_id", folderId)
      .limit(1);

    if (existing && existing.length > 0) {
      return { success: false, error: "This folder is already registered" };
    }

    // Verify we can access the folder by listing its contents
    const docs = await listFolderDocuments(folderId);
    if (docs === null) {
      return {
        success: false,
        error: "Unable to access this folder. Check that the service account has access.",
      };
    }

    // Register the folder
    const { error: insertError } = await supabase
      .from("drive_folders")
      .insert({
        folder_id: folderId,
        folder_url: folderUrl.trim(),
        name: trimmedName,
        registered_by: user.id,
      });

    if (insertError) {
      logger.error("Failed to register Drive folder", {
        error: insertError.message,
      });
      return { success: false, error: "Failed to register folder" };
    }

    revalidate();
    return { success: true };
  } catch (error) {
    logger.error("registerDriveFolder error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to register folder" };
  }
}

/**
 * Unregister a Google Drive folder.
 * Does NOT unlink any articles that were linked from this folder.
 */
export async function unregisterDriveFolder(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireContentEditor();
    const supabase = createServiceClient();

    const { error: deleteError } = await supabase
      .from("drive_folders")
      .delete()
      .eq("id", id);

    if (deleteError) {
      logger.error("Failed to unregister Drive folder", {
        error: deleteError.message,
      });
      return { success: false, error: "Failed to unregister folder" };
    }

    revalidate();
    return { success: true };
  } catch (error) {
    logger.error("unregisterDriveFolder error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to unregister folder" };
  }
}

/**
 * List all registered Drive folders.
 */
export async function getRegisteredFolders(): Promise<
  Array<{
    id: string;
    folder_id: string;
    folder_url: string;
    name: string;
    created_at: string;
  }>
> {
  try {
    await requireContentEditor();
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("drive_folders")
      .select("id, folder_id, folder_url, name, created_at")
      .order("name");

    if (error) {
      logger.error("Failed to list Drive folders", { error: error.message });
      return [];
    }

    return data ?? [];
  } catch (error) {
    logger.error("Failed to get registered folders", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * List Google Docs in a registered folder.
 */
export async function listRegisteredFolderDocs(driveFolderId: string): Promise<
  Array<{
    id: string;
    name: string;
    modifiedTime: string;
    webViewLink: string;
    alreadyLinked: boolean;
  }>
> {
  try {
    await requireContentEditor();
    const supabase = createServiceClient();

    // Get the folder's Google Drive ID
    const { data: folder } = await supabase
      .from("drive_folders")
      .select("folder_id")
      .eq("id", driveFolderId)
      .single();

    if (!folder) {
      return [];
    }

    // List docs from Google Drive
    const docs = await listFolderDocuments(folder.folder_id);

    if (!docs) {
      return [];
    }

    // Check which docs are already linked
    const docIds = docs.map((d) => d.id);
    const { data: linkedArticles } = await supabase
      .from("resource_articles")
      .select("google_doc_id")
      .in("google_doc_id", docIds);

    const linkedDocIds = new Set(
      (linkedArticles ?? []).map((a) => a.google_doc_id)
    );

    return docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      modifiedTime: doc.modifiedTime,
      webViewLink: doc.webViewLink,
      alreadyLinked: linkedDocIds.has(doc.id),
    }));
  } catch (error) {
    logger.error("listRegisteredFolderDocs error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// =============================================
// LINK / UNLINK GOOGLE DOCS
// =============================================

/**
 * Link a Google Doc to the intranet as a resource article.
 *
 * Fetches the doc metadata + content, creates an article record,
 * and optionally sets up a webhook watch channel.
 */
export async function linkGoogleDoc(
  docUrl: string,
  categoryId: string,
  customTitle?: string
): Promise<{ success: boolean; error?: string; articleId?: string; slug?: string }> {
  try {
    const { supabase, user } = await requireContentEditor();

    // Parse doc ID from URL
    const docId = extractDocId(docUrl);
    if (!docId) {
      return {
        success: false,
        error: "Invalid Google Docs URL. Expected format: https://docs.google.com/document/d/.../edit",
      };
    }

    // Check if this doc is already linked
    const serviceClient = createServiceClient();
    const { data: existing } = await serviceClient
      .from("resource_articles")
      .select("id")
      .eq("google_doc_id", docId)
      .limit(1);

    if (existing && existing.length > 0) {
      return {
        success: false,
        error: "This Google Doc is already linked to the intranet",
      };
    }

    // Verify the category exists
    const { data: category } = await supabase
      .from("resource_categories")
      .select("id, name, slug")
      .eq("id", categoryId)
      .single();

    if (!category) {
      return { success: false, error: "Category not found" };
    }

    // Get doc metadata from Google
    const metadata = await getDocumentMetadata(docId);
    if (!metadata) {
      return {
        success: false,
        error: "Unable to access this Google Doc. Check that the service account has access.",
      };
    }

    // Use custom title or Google Doc title
    const title = (customTitle?.trim() || metadata.name).substring(
      0,
      MAX_TITLE_LENGTH
    );

    // Generate unique slug
    const baseSlug = slugify(title);
    if (!baseSlug) {
      return { success: false, error: "Unable to generate a URL slug from the title" };
    }
    const slug = await ensureUniqueArticleSlug(serviceClient, baseSlug);

    // Sync content from Google Docs
    let html = "";
    let plaintext = "";
    let modifiedTime: string | null = null;
    // Track whether the initial content fetch actually worked. We deliberately
    // swallow the error so the article row still gets created (editors can
    // retry via Sync now later), but we must not record last_synced_at = now
    // for a failed sync — that would mislead the kebab state machine into
    // rendering "Synced just now" when there's no content.
    let syncSuccess = false;
    try {
      const synced = await syncDocumentContent(docId);
      html = synced.html;
      plaintext = synced.plaintext;
      modifiedTime = synced.modifiedTime;
      syncSuccess = true;
    } catch (syncError) {
      logger.warn("Failed to sync doc content during link — proceeding with empty content", {
        docId,
        error: syncError instanceof Error ? syncError.message : String(syncError),
      });
    }

    // Create the article record
    const { data: article, error: insertError } = await serviceClient
      .from("resource_articles")
      .insert({
        category_id: categoryId,
        title,
        slug,
        content: plaintext,
        content_type: "google_doc",
        google_doc_id: docId,
        google_doc_url: metadata.webViewLink,
        synced_html: html,
        last_synced_at: syncSuccess ? new Date().toISOString() : null,
        google_doc_modified_at: modifiedTime,
        status: "published",
        author_id: user.id,
        visibility: null, // Inherit from category
      })
      .select("id, slug")
      .single();

    if (insertError || !article) {
      // Handle slug/google_doc_id unique-violation (23505) from a concurrent
      // link — rare but possible despite the pre-check.
      if (insertError?.code === "23505") {
        return {
          success: false,
          error:
            "This document or its slug is already linked. Try a different custom title.",
        };
      }
      logger.error("Failed to create article for linked Google Doc", {
        error: insertError?.message,
      });
      return { success: false, error: "Failed to link Google Doc" };
    }

    // Set up webhook watch channel (non-critical — don't fail if this errors)
    try {
      // Trim both env vars — trailing whitespace from dashboard paste has
      // bitten us once (Drive rejected the webhook URL over a trailing \n).
      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
      const webhookSecret = process.env.GOOGLE_DRIVE_WEBHOOK_SECRET?.trim();

      if (appUrl && webhookSecret) {
        const webhookUrl = `${appUrl}/api/drive/webhook`;
        const channelId = `resource-${article.id}-${Date.now()}`;
        const watchResult = await watchFile(
          docId,
          channelId,
          webhookUrl,
          `${webhookSecret}:${docId}`
        );

        // Persist the full watch lifecycle state so the renewal cron and
        // unlink path can both operate without reconstructing the channel id.
        // Fallback to 25h: matches Drive's observed ~24h lifetime plus buffer.
        // The value is advisory for our cron's decision; Drive controls real
        // channel expiry. 25h over shorter values so the row doesn't read as
        // "expired" while the underlying channel is still live. Verified
        // 2026-04-20.
        if (watchResult?.resourceId) {
          const expirationMs = Number(watchResult.expiration);
          const expiresAt = Number.isFinite(expirationMs) && expirationMs > 0
            ? new Date(expirationMs).toISOString()
            : new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();
          await serviceClient
            .from("resource_articles")
            .update({
              google_watch_channel_id: watchResult.channelId,
              google_watch_resource_id: watchResult.resourceId,
              google_watch_expires_at: expiresAt,
            })
            .eq("id", article.id);
        }
      }
    } catch (watchError) {
      logger.warn("Failed to set up Drive watch — manual sync still works", {
        articleId: article.id,
        error: watchError instanceof Error ? watchError.message : String(watchError),
      });
    }

    // Index sections in Algolia (non-critical)
    if (html) {
      const sections = parseHtmlIntoSections(html);
      await indexArticleSections(
        article.id,
        article.slug as string,
        title,
        "google_doc",
        category.name as string,
        category.slug as string,
        sections,
        new Date().toISOString()
      );
    }

    revalidate();
    return { success: true, articleId: article.id, slug: article.slug as string };
  } catch (error) {
    logger.error("linkGoogleDoc error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to link Google Doc" };
  }
}

/**
 * Unlink a Google Doc from the intranet.
 * Hard-deletes the article record. The Google Doc stays in Drive.
 */
export async function unlinkGoogleDoc(
  articleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireContentEditor();
    const supabase = createServiceClient();

    // Get article to verify it's a Google Doc
    const { data: article } = await supabase
      .from("resource_articles")
      .select("id, google_doc_id, content_type, google_watch_channel_id, google_watch_resource_id")
      .eq("id", articleId)
      .single();

    if (!article) {
      return { success: false, error: "Article not found" };
    }

    if (article.content_type !== "google_doc") {
      return { success: false, error: "This article is not a linked Google Doc" };
    }

    // Stop the Drive watch channel if we have the resourceId. Pre-00081 rows
    // stored only the resource id and relied on the `resource-${id}` channel
    // id pattern — fall back to that for rows that haven't been renewed yet.
    if (article.google_watch_resource_id) {
      try {
        const channelId = article.google_watch_channel_id ?? `resource-${articleId}`;
        await stopWatchChannel(channelId, article.google_watch_resource_id);
      } catch (watchError) {
        logger.warn("Failed to stop Drive watch channel during unlink", {
          articleId,
          error: watchError instanceof Error ? watchError.message : String(watchError),
        });
      }
    }

    // Remove from Algolia index (non-critical, before DB delete)
    await removeArticleFromIndex(articleId);

    // Hard-delete the article
    const { error: deleteError } = await supabase
      .from("resource_articles")
      .delete()
      .eq("id", articleId);

    if (deleteError) {
      logger.error("Failed to unlink Google Doc", {
        error: deleteError.message,
      });
      return { success: false, error: "Failed to unlink Google Doc" };
    }

    revalidate();
    return { success: true };
  } catch (error) {
    logger.error("unlinkGoogleDoc error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to unlink Google Doc" };
  }
}

// =============================================
// SYNC
// =============================================

/**
 * Manually re-sync a single article from its Google Doc.
 */
export async function syncArticle(
  articleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireContentEditor();
    const supabase = createServiceClient();

    // Get article with category info for Algolia indexing
    const { data: article } = await supabase
      .from("resource_articles")
      .select("id, slug, title, google_doc_id, content_type, category:resource_categories!category_id(name, slug)")
      .eq("id", articleId)
      .single();

    if (!article) {
      return { success: false, error: "Article not found" };
    }

    if (article.content_type !== "google_doc" || !article.google_doc_id) {
      return { success: false, error: "This article is not a linked Google Doc" };
    }

    // Fetch and sanitise content
    const { html, plaintext, modifiedTime } = await syncDocumentContent(article.google_doc_id);

    // Update the article
    const { error: updateError } = await supabase
      .from("resource_articles")
      .update({
        synced_html: html,
        content: plaintext,
        last_synced_at: new Date().toISOString(),
        google_doc_modified_at: modifiedTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", article.id);

    if (updateError) {
      logger.error("Failed to sync article", { error: updateError.message });
      return { success: false, error: "Failed to sync article" };
    }

    // Re-index sections in Algolia (non-critical)
    const catData = article.category as unknown;
    const cat = (Array.isArray(catData) ? catData[0] : catData) as { name: string; slug: string } | null;
    if (cat) {
      const sections = parseHtmlIntoSections(html);
      await indexArticleSections(
        article.id as string,
        article.slug as string,
        article.title as string,
        "google_doc",
        cat.name,
        cat.slug,
        sections,
        new Date().toISOString()
      );
    }

    revalidatePath(`/resources/article/${article.slug}`);
    revalidate();
    return { success: true };
  } catch (error) {
    logger.error("syncArticle error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to sync article" };
  }
}

/**
 * Sync all Google Doc articles. Used as a bulk refresh.
 */
export async function syncAllArticles(): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  error?: string;
}> {
  try {
    await requireContentEditor();
    const supabase = createServiceClient();

    // Get all Google Doc articles
    const { data: articles } = await supabase
      .from("resource_articles")
      .select("id, slug, google_doc_id")
      .eq("content_type", "google_doc")
      .not("google_doc_id", "is", null);

    if (!articles || articles.length === 0) {
      return { success: true, synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    // Sync each article (sequentially to avoid rate limits)
    for (const article of articles) {
      if (!article.google_doc_id) continue;

      try {
        const { html, plaintext, modifiedTime } = await syncDocumentContent(
          article.google_doc_id
        );

        const { error: updateError } = await supabase
          .from("resource_articles")
          .update({
            synced_html: html,
            content: plaintext,
            last_synced_at: new Date().toISOString(),
            google_doc_modified_at: modifiedTime,
            updated_at: new Date().toISOString(),
          })
          .eq("id", article.id);

        if (updateError) {
          failed++;
          logger.error("Bulk sync: failed to update article", {
            articleId: article.id,
            error: updateError.message,
          });
        } else {
          synced++;
        }
      } catch (syncError) {
        failed++;
        logger.error("Bulk sync: failed to fetch doc content", {
          articleId: article.id,
          error:
            syncError instanceof Error
              ? syncError.message
              : String(syncError),
        });
      }
    }

    revalidate();
    return { success: true, synced, failed };
  } catch (error) {
    logger.error("syncAllArticles error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, synced: 0, failed: 0, error: "Failed to sync articles" };
  }
}
