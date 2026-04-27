"use server";

import { getCurrentUser, isSystemsAdminEffective } from "@/lib/auth";
import {
  POST_MAX_LENGTH,
  ATTACHMENT_MAX_COUNT,
  IMAGE_MAX_SIZE_BYTES,
  DOCUMENT_MAX_SIZE_BYTES,
  ALLOWED_FILE_TYPES,
  isImageType,
} from "@/lib/intranet";
import {
  uploadFileToDrive,
  deleteFileFromDrive,
  sanitiseFilename,
} from "@/lib/google-drive-upload";
import { processUploadedImage } from "@/lib/image-pipeline";
import { extractUrls } from "@/lib/url";
import { extractMentionIds, type TiptapDocument } from "@/lib/tiptap";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { resolveExternalUrl } from "@/lib/ssrf";
import { sendAndLogEmail } from "@/lib/email-queue";
import { baseTemplate, escapeHtml } from "@/lib/email";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Json,
  ReactionType,
  PostWithRelations,
  PostAuthor,
  CommentWithAuthor,
  CommentAuthor,
} from "@/types/database.types";

/**
 * Queue mention notification emails for a list of mentioned user IDs.
 * Used by both createPost and addComment to avoid duplication.
 */
async function sendMentionEmails(
  supabase: SupabaseClient,
  authorId: string,
  mentionIds: string[],
  entityId: string,
  entityType: "post" | "comment",
  contentPreview: string,
  postId: string,
) {
  const { data: authorProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", authorId)
    .single();
  const authorName = authorProfile?.full_name ?? "Someone";
  const preview = contentPreview.slice(0, 100);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.mcrpathways.org";

  // Filter out the author — don't email yourself about your own mention
  const recipientIds = mentionIds.filter((id) => id !== authorId);
  if (recipientIds.length === 0) return;

  const { data: mentionedProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", recipientIds);

  for (const mp of mentionedProfiles ?? []) {
    const safeAuthor = escapeHtml(authorName);
    const safePreview = escapeHtml(preview);
    const subject = `${authorName} mentioned you in a ${entityType}`;
    const html = baseTemplate(
      `${authorName} mentioned you`,
      `<p style="font-size: 14px; color: #213350;"><strong>${safeAuthor}</strong> mentioned you in a ${entityType}${safePreview ? ":" : "."}</p>
       ${safePreview ? `<div style="background: #F2F4F7; padding: 12px 16px; border-radius: 8px; margin: 12px 0; font-size: 14px; color: #374151; border-left: 3px solid #751B48;">${safePreview}${preview.length >= 100 ? "..." : ""}</div>` : ""}
       <a href="${appUrl}/intranet/post/${postId}" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; border: 2px solid #213350; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 8px;">View Post →</a>`,
      { preheader: `${authorName} mentioned you: ${preview || ""}`.trim(), emailType: "mention" }
    );

    await sendAndLogEmail({
      userId: mp.id,
      email: mp.email,
      emailType: "mention",
      subject,
      bodyHtml: html,
      entityId,
      entityType,
    });
  }
}

const POST_SELECT =
  "id, author_id, content, content_json, is_pinned, is_weekly_roundup, weekly_roundup_id, poll_question, poll_closes_at, poll_allow_multiple, created_at, updated_at";
const ATTACHMENT_SELECT =
  "id, post_id, attachment_type, file_url, drive_file_id, file_name, file_size, mime_type, image_width, image_height, link_url, link_title, link_description, link_image_url, sort_order, created_at";
const REACTION_SELECT = "id, post_id, user_id, reaction_type, created_at";
const COMMENT_SELECT =
  "id, post_id, author_id, content, content_json, parent_id, created_at, updated_at";
const COMMENT_REACTION_SELECT =
  "id, comment_id, user_id, reaction_type, created_at";
const AUTHOR_SELECT =
  "id, full_name, preferred_name, avatar_url, job_title";

const VALID_REACTIONS: ReactionType[] = [
  "like",
  "love",
  "celebrate",
  "insightful",
  "curious",
];

const ALLOWED_ATTACHMENT_FIELDS_SHARED = [
  "attachment_type",
  "file_url",
  "drive_file_id",
  "file_name",
  "file_size",
  "mime_type",
  "image_width",
  "image_height",
  "link_url",
  "link_title",
  "link_description",
  "link_image_url",
] as const;

/**
 * Delete the underlying Drive files for the given attachments.
 * Best-effort — logs failures but doesn't throw, so DB cleanup can proceed.
 * Drive 404s are already swallowed by deleteFileFromDrive.
 */
async function deleteAttachmentFiles(
  driveFileIds: (string | null)[],
): Promise<void> {
  const ids = driveFileIds.filter((id): id is string => id !== null);
  if (ids.length === 0) return;

  const results = await Promise.allSettled(
    ids.map((id) => deleteFileFromDrive(id)),
  );
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      logger.warn("Drive attachment delete failed", {
        fileId: ids[i],
        reason: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });
}

// ─── Weekly Roundup Types ─────────────────────────────────────────────

/** Base fields shared by all weekly roundup responses */
type WeeklyRoundupBase = {
  id: string;
  title: string;
  summary: string | null;
  week_start: string;
  week_end: string;
};

type ActiveRoundup = WeeklyRoundupBase & { pinned_until: string | null };
type RoundupListItem = WeeklyRoundupBase & { created_at: string };

// ─── Internal Link Preview Helper ────────────────────────────────────

/**
 * Internal link preview fetcher (no auth check).
 * Used by createPost/editPost for server-side auto-detection
 * and by the public fetchLinkPreview action.
 */
async function _fetchLinkPreviewInternal(url: string): Promise<{
  title?: string;
  description?: string;
  imageUrl?: string;
} | null> {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;

    // Fetch with redirect validation — each hop is checked against private IPs
    const MAX_REDIRECTS = 3;
    let currentUrl = url;
    let response: Response | null = null;

    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const resolvedIp = await resolveExternalUrl(currentUrl);
      if (!resolvedIp) return null;

      response = await fetch(currentUrl, {
        headers: { "User-Agent": "MCR-Intranet-Bot/1.0" },
        signal: AbortSignal.timeout(5000),
        redirect: "manual",
      });

      // Follow redirects with SSRF validation on each hop
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || i === MAX_REDIRECTS) return null;
        currentUrl = new URL(location, currentUrl).toString();
        const redirectParsed = new URL(currentUrl);
        if (!["http:", "https:"].includes(redirectParsed.protocol)) return null;
        continue;
      }

      break;
    }

    if (!response?.ok) return null;

    // Only process HTML responses to avoid reading large binary files
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("text/html")) return null;

    // Read body with a 512KB size limit to prevent OOM from huge responses.
    // OG meta tags appear in <head>, so 512KB is more than sufficient.
    const MAX_PREVIEW_BODY_BYTES = 512 * 1024;
    const reader = response.body?.getReader();
    if (!reader) return null;

    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    let result: ReadableStreamReadResult<Uint8Array>;
    while (!(result = await reader.read()).done) {
      const { value } = result;
      totalSize += value.byteLength;
      if (totalSize > MAX_PREVIEW_BODY_BYTES) {
        reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const html = new TextDecoder().decode(Buffer.concat(chunks));

    const getMetaContent = (property: string): string | undefined => {
      const regex = new RegExp(
        `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
        "i"
      );
      const altRegex = new RegExp(
        `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
        "i"
      );
      return regex.exec(html)?.[1] ?? altRegex.exec(html)?.[1];
    };

    const title =
      getMetaContent("og:title") ??
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    const description =
      getMetaContent("og:description") ?? getMetaContent("description");
    const rawImageUrl = getMetaContent("og:image");
    // Proxy external OG images through our own domain so CSP img-src 'self' allows them
    const imageUrl = rawImageUrl
      ? `/api/og-image?url=${encodeURIComponent(rawImageUrl)}`
      : undefined;

    return {
      title: title?.slice(0, 200),
      description: description?.slice(0, 500),
      imageUrl,
    };
  } catch {
    return null;
  }
}

function buildReactionCounts(
  reactions: { reaction_type: ReactionType }[]
): Record<ReactionType, number> {
  const counts: Record<ReactionType, number> = {
    like: 0,
    love: 0,
    celebrate: 0,
    insightful: 0,
    curious: 0,
  };
  for (const r of reactions) {
    counts[r.reaction_type]++;
  }
  return counts;
}

/**
 * Enrich flat comments with pre-fetched reactions and build threaded structure.
 * Synchronous — all reaction data is passed in, no DB queries.
 * Returns top-level comments with replies nested inside.
 */
function threadComments(
  flatComments: Record<string, unknown>[],
  commentReactions: { id: string; comment_id: string; user_id: string; reaction_type: ReactionType; created_at: string }[],
  userId: string
): CommentWithAuthor[] {
  if (flatComments.length === 0) return [];

  // Group comment reactions by comment_id
  const reactionsByComment = new Map<string, typeof commentReactions>();
  for (const cr of commentReactions) {
    const existing = reactionsByComment.get(cr.comment_id) ?? [];
    existing.push(cr);
    reactionsByComment.set(cr.comment_id, existing);
  }

  // Enrich each comment with reactions
  const enrichedComments: CommentWithAuthor[] = flatComments.map((c) => {
    const comment = c as { id: string; post_id: string; author_id: string; content: string; content_json: Json | null; parent_id: string | null; created_at: string; updated_at: string; author: unknown };
    const cReactions = reactionsByComment.get(comment.id) ?? [];
    const userCReaction = cReactions.find((r) => r.user_id === userId);

    return {
      id: comment.id,
      post_id: comment.post_id,
      author_id: comment.author_id,
      content: comment.content,
      content_json: comment.content_json ?? null,
      parent_id: comment.parent_id,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      author: comment.author as unknown as CommentAuthor,
      reactions: cReactions,
      reaction_counts: buildReactionCounts(cReactions),
      user_reaction: (userCReaction?.reaction_type as ReactionType) ?? null,
      replies: [],
    };
  });

  // Build threaded structure: top-level + nested replies
  const commentMap = new Map<string, CommentWithAuthor>();
  for (const c of enrichedComments) {
    commentMap.set(c.id, c);
  }

  const topLevelComments: CommentWithAuthor[] = [];
  for (const c of enrichedComments) {
    if (c.parent_id && commentMap.has(c.parent_id)) {
      commentMap.get(c.parent_id)!.replies.push(c);
    } else {
      topLevelComments.push(c);
    }
  }

  return topLevelComments;
}

// ─── Shared Post Enrichment ─────────────────────────────────────────

/**
 * Enrich raw post rows with attachments, reactions, and threaded comments.
 * Shared by fetchPostsWithClient and fetchRoundupPostsWithClient to eliminate duplication.
 * Runs 3 parallel queries (attachments, reactions, comments) + 1 sequential (comment reactions).
 */
async function enrichPosts(
  supabase: SupabaseClient,
  userId: string,
  postRows: Record<string, unknown>[]
): Promise<PostWithRelations[]> {
  const postIds = postRows.map((p) => (p as { id: string }).id);

  if (postIds.length === 0) return [];

  const [attachmentsResult, reactionsResult, commentsResult] =
    await Promise.all([
      supabase
        .from("post_attachments")
        .select(ATTACHMENT_SELECT)
        .in("post_id", postIds)
        .order("sort_order"),
      supabase
        .from("post_reactions")
        .select(REACTION_SELECT)
        .in("post_id", postIds),
      supabase
        .from("post_comments")
        .select(
          `${COMMENT_SELECT}, author:profiles!author_id(${AUTHOR_SELECT})`
        )
        .in("post_id", postIds)
        .order("created_at", { ascending: true }),
    ]);

  const attachments = attachmentsResult.data ?? [];
  const reactions = reactionsResult.data ?? [];
  const comments = commentsResult.data ?? [];

  const attachmentsByPost = new Map<string, typeof attachments>();
  for (const a of attachments) {
    const existing = attachmentsByPost.get(a.post_id) ?? [];
    existing.push(a);
    attachmentsByPost.set(a.post_id, existing);
  }

  const reactionsByPost = new Map<string, typeof reactions>();
  for (const r of reactions) {
    const existing = reactionsByPost.get(r.post_id) ?? [];
    existing.push(r);
    reactionsByPost.set(r.post_id, existing);
  }

  const commentsByPost = new Map<string, typeof comments>();
  for (const c of comments) {
    const existing = commentsByPost.get(c.post_id) ?? [];
    existing.push(c);
    commentsByPost.set(c.post_id, existing);
  }

  // Batch-fetch ALL comment reactions in a single query (avoids N sequential queries)
  const allCommentIds = comments.map((c) => c.id);
  const { data: allCommentReactions } =
    allCommentIds.length > 0
      ? await supabase
          .from("comment_reactions")
          .select(COMMENT_REACTION_SELECT)
          .in("comment_id", allCommentIds)
      : { data: [] };

  // Thread comments per-post using pre-fetched reactions (no DB calls)
  const threadedCommentsByPost = new Map<string, CommentWithAuthor[]>();
  for (const [postId, postComments] of commentsByPost) {
    const threaded = threadComments(
      postComments as unknown as Record<string, unknown>[],
      allCommentReactions ?? [],
      userId
    );
    threadedCommentsByPost.set(postId, threaded);
  }

  // ─── Poll data enrichment ─────────────────────────────────────────
  const pollPostIds = postRows
    .filter((p) => (p as { poll_question: string | null }).poll_question)
    .map((p) => (p as { id: string }).id);

  const pollOptionsByPost = new Map<string, Array<{ id: string; option_text: string; display_order: number }>>();
  const pollVotesByPost = new Map<string, Array<{ option_id: string; user_id: string }>>();

  if (pollPostIds.length > 0) {
    const [optionsResult, votesResult] = await Promise.all([
      supabase
        .from("poll_options")
        .select("id, post_id, option_text, display_order")
        .in("post_id", pollPostIds)
        .order("display_order"),
      supabase
        .from("poll_votes")
        .select("post_id, option_id, user_id")
        .in("post_id", pollPostIds),
    ]);

    for (const opt of optionsResult.data ?? []) {
      const existing = pollOptionsByPost.get(opt.post_id) ?? [];
      existing.push(opt);
      pollOptionsByPost.set(opt.post_id, existing);
    }

    for (const vote of votesResult.data ?? []) {
      const existing = pollVotesByPost.get(vote.post_id) ?? [];
      existing.push(vote);
      pollVotesByPost.set(vote.post_id, existing);
    }
  }

  return postRows.map((post) => {
    const p = post as { id: string; author_id: string; content: string; content_json: Json | null; is_pinned: boolean; is_weekly_roundup: boolean; weekly_roundup_id: string | null; poll_question: string | null; poll_closes_at: string | null; poll_allow_multiple: boolean; created_at: string; updated_at: string; author: unknown };
    const postReactions = reactionsByPost.get(p.id) ?? [];
    const postComments = commentsByPost.get(p.id) ?? [];
    const userReaction = postReactions.find((r) => r.user_id === userId);

    return {
      id: p.id,
      author_id: p.author_id,
      content: p.content,
      content_json: p.content_json ?? null,
      is_pinned: p.is_pinned,
      is_weekly_roundup: p.is_weekly_roundup,
      weekly_roundup_id: p.weekly_roundup_id,
      poll_question: p.poll_question,
      poll_closes_at: p.poll_closes_at,
      poll_allow_multiple: p.poll_allow_multiple,
      created_at: p.created_at,
      updated_at: p.updated_at,
      author: p.author as unknown as PostAuthor,
      attachments: attachmentsByPost.get(p.id) ?? [],
      reactions: postReactions,
      comments: threadedCommentsByPost.get(p.id) ?? [],
      reaction_counts: buildReactionCounts(postReactions),
      user_reaction: (userReaction?.reaction_type as ReactionType) ?? null,
      comment_count: postComments.length,
      poll: p.poll_question ? (() => {
        const options = pollOptionsByPost.get(p.id) ?? [];
        const votes = pollVotesByPost.get(p.id) ?? [];
        const allowMultiple = p.poll_allow_multiple ?? false;
        const userVotes = votes.filter((v) => v.user_id === userId);
        const voteCounts = new Map<string, number>();
        for (const v of votes) {
          voteCounts.set(v.option_id, (voteCounts.get(v.option_id) ?? 0) + 1);
        }
        // For multi-select: total_votes = unique voters, not total vote rows
        const uniqueVoters = new Set(votes.map((v) => v.user_id)).size;
        return {
          question: p.poll_question!,
          options: options.map((o) => ({
            id: o.id,
            option_text: o.option_text,
            display_order: o.display_order,
            vote_count: voteCounts.get(o.id) ?? 0,
          })),
          total_votes: allowMultiple ? uniqueVoters : votes.length,
          user_vote_option_id: !allowMultiple && userVotes.length > 0 ? userVotes[0].option_id : null,
          user_vote_option_ids: userVotes.map((v) => v.option_id),
          closes_at: p.poll_closes_at,
          is_closed: p.poll_closes_at ? new Date(p.poll_closes_at) < new Date() : false,
          allow_multiple: allowMultiple,
        };
      })() : null,
    };
  });
}

// ─── Helper functions (accept supabase client, avoid multiple getCurrentUser() calls in SSR) ───

/**
 * Fetch posts with an existing supabase client.
 * Used by Server Components that already have an authenticated client.
 */
export async function fetchPostsWithClient(
  supabase: SupabaseClient,
  userId: string,
  page: number = 1,
  pageSize: number = 10
): Promise<{ posts: PostWithRelations[]; hasMore: boolean; error: string | null }> {
  const offset = (page - 1) * pageSize;

  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select(
      `${POST_SELECT}, author:profiles!author_id(${AUTHOR_SELECT})`
    )
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    // Supabase .range() is inclusive on both ends: range(0, 10) returns rows 0..10 = 11 rows.
    // We request pageSize+1 rows to detect whether another page exists beyond this one.
    .range(offset, offset + pageSize);

  if (postsError || !posts) {
    return {
      posts: [],
      hasMore: false,
      error: postsError?.message ?? "Failed to fetch posts",
    };
  }

  const hasMore = posts.length > pageSize;
  const postsSlice = posts.slice(0, pageSize);

  if (postsSlice.length === 0) {
    return { posts: [], hasMore: false, error: null };
  }

  const enrichedPosts = await enrichPosts(supabase, userId, postsSlice);
  return { posts: enrichedPosts, hasMore, error: null };
}

/**
 * Fetch a single post by ID with all relations (attachments, reactions, threaded comments).
 * Used by the standalone post page (/intranet/post/[id]).
 */
export async function fetchPostByIdWithClient(
  supabase: SupabaseClient,
  userId: string,
  postId: string
): Promise<PostWithRelations | null> {
  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) {
    return null;
  }

  const { data: post, error } = await supabase
    .from("posts")
    .select(
      `${POST_SELECT}, author:profiles!author_id(${AUTHOR_SELECT})`
    )
    .eq("id", postId)
    .single();

  if (error || !post) return null;

  const enriched = await enrichPosts(supabase, userId, [post]);
  return enriched[0] ?? null;
}

/**
 * Fetch the active weekly roundup with an existing supabase client.
 */
export async function fetchActiveRoundupWithClient(
  supabase: SupabaseClient
): Promise<{
  roundup: ActiveRoundup | null;
  error: string | null;
}> {
  const { data: roundup } = await supabase
    .from("weekly_roundups")
    .select("id, title, summary, week_start, week_end, pinned_until")
    .gt("pinned_until", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return { roundup: roundup ?? null, error: null };
}

/**
 * Fetch all weekly roundups with an existing supabase client.
 */
export async function fetchWeeklyRoundupsWithClient(
  supabase: SupabaseClient
): Promise<{
  roundups: RoundupListItem[];
  error: string | null;
}> {
  const { data: roundups, error } = await supabase
    .from("weekly_roundups")
    .select("id, title, summary, week_start, week_end, created_at")
    .order("week_start", { ascending: false })
    .limit(52);

  if (error) {
    logger.error("Failed to fetch weekly roundups", { error });
    return { roundups: [], error: "Failed to fetch weekly roundups. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  return { roundups: roundups ?? [], error: null };
}

/**
 * Fetch a specific roundup and its posts with an existing supabase client.
 */
export async function fetchRoundupPostsWithClient(
  supabase: SupabaseClient,
  userId: string,
  roundupId: string
): Promise<{
  roundup: WeeklyRoundupBase | null;
  posts: PostWithRelations[];
  error: string | null;
}> {
  const { data: roundup } = await supabase
    .from("weekly_roundups")
    // post_ids is used below to fetch related posts; not included in the returned roundup object
    .select("id, title, summary, week_start, week_end, post_ids")
    .eq("id", roundupId)
    .single();

  if (!roundup) {
    return { roundup: null, posts: [], error: "Round up not found" };
  }

  if (!roundup.post_ids || roundup.post_ids.length === 0) {
    return {
      roundup: { id: roundup.id, title: roundup.title, summary: roundup.summary, week_start: roundup.week_start, week_end: roundup.week_end },
      posts: [],
      error: null,
    };
  }

  const { data: posts } = await supabase
    .from("posts")
    .select(
      `${POST_SELECT}, author:profiles!author_id(${AUTHOR_SELECT})`
    )
    .in("id", roundup.post_ids)
    .order("created_at", { ascending: false });

  const roundupData = { id: roundup.id, title: roundup.title, summary: roundup.summary, week_start: roundup.week_start, week_end: roundup.week_end };

  if (!posts || posts.length === 0) {
    return { roundup: roundupData, posts: [], error: null };
  }

  const enrichedPosts = await enrichPosts(supabase, userId, posts);
  return { roundup: roundupData, posts: enrichedPosts, error: null };
}

// ─── Post CRUD ───────────────────────────────────────────────────────

export async function createPost(data: {
  content: string;
  content_json?: TiptapDocument | null;
  attachments?: {
    attachment_type: "image" | "document" | "link";
    file_url?: string;
    drive_file_id?: string;
    file_name?: string;
    file_size?: number;
    mime_type?: string;
    image_width?: number;
    image_height?: number;
    link_url?: string;
    link_title?: string;
    link_description?: string;
    link_image_url?: string;
  }[];
  poll?: {
    question: string;
    options: string[];
    closes_at?: string | null;
    allow_multiple?: boolean;
  };
}): Promise<{ success: boolean; error: string | null; postId?: string; warning?: string }> {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile) {
    return { success: false, error: "Not authenticated" };
  }

  const content = data.content?.trim();
  if (!content || content.length === 0 || content.length > POST_MAX_LENGTH) {
    return {
      success: false,
      error: `Content must be between 1 and ${POST_MAX_LENGTH.toLocaleString()} characters`,
    };
  }

  // Build insert payload — include content_json if provided (Tiptap rich text)
  const postInsert: Database["public"]["Tables"]["posts"]["Insert"] = {
    author_id: user.id,
    content,
    ...(data.content_json ? { content_json: data.content_json as unknown as Json } : {}),
    ...(data.poll?.question ? {
      poll_question: data.poll.question,
      poll_allow_multiple: data.poll.allow_multiple ?? false,
      ...(data.poll.closes_at ? { poll_closes_at: data.poll.closes_at } : {}),
    } : {}),
  };

  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert(postInsert)
    .select("id")
    .single();

  if (postError || !post) {
    return {
      success: false,
      error: postError?.message ?? "Failed to create post",
    };
  }

  // Insert poll options if this is a poll post
  if (data.poll?.question && data.poll.options.length >= 2 && post) {
    const pollOptionsData = data.poll.options
      .filter((text) => text.trim().length > 0)
      .map((text, i) => ({
        post_id: post.id,
        option_text: text.trim(),
        display_order: i,
      }));
    await supabase.from("poll_options").insert(pollOptionsData);
  }

  // Insert mentions if content_json contains @mentions
  if (data.content_json) {
    const mentionIds = extractMentionIds(data.content_json);
    if (mentionIds.length > 0) {
      // Insert mention records
      await supabase.from("post_mentions").insert(
        mentionIds.map((uid) => ({
          post_id: post.id,
          mentioned_user_id: uid,
        }))
      );
      // Send in-app notifications via RPC
      await supabase.rpc("notify_mention", {
        p_mentioned_user_ids: mentionIds,
        p_entity_type: "post",
        p_entity_id: post.id,
        p_post_id: post.id,
      });

      // Queue mention emails (non-blocking)
      try {
        await sendMentionEmails(supabase, user.id, mentionIds, post.id, "post", data.content ?? "", post.id);
      } catch (emailErr) {
        logger.error("Failed to queue mention emails", { error: emailErr });
      }
    }
  }

  // Insert attachments if provided
  if (data.attachments && data.attachments.length > 0) {
    const attachments = data.attachments.slice(0, ATTACHMENT_MAX_COUNT).map((att, index) => {
      const sanitized: Record<string, unknown> = {
        post_id: post.id,
        sort_order: index,
      };
      for (const field of ALLOWED_ATTACHMENT_FIELDS_SHARED) {
        if (field in att && att[field] !== undefined) {
          sanitized[field] = att[field];
        }
      }
      return sanitized;
    }) as Database["public"]["Tables"]["post_attachments"]["Insert"][];

    const { error: attError } = await supabase
      .from("post_attachments")
      .insert(attachments);

    if (attError) {
      revalidatePath("/intranet", "layout");
      return {
        success: true,
        error: null,
        postId: post.id,
        warning: "Post created, but some attachments could not be saved",
      };
    }
  }

  // Auto-detect first URL in content and create link preview attachment
  const detectedUrls = extractUrls(content);
  if (detectedUrls.length > 0) {
    const firstUrl = detectedUrls[0];
    const hasLinkForUrl = (data.attachments ?? []).some(
      (a) => a.attachment_type === "link" && a.link_url === firstUrl
    );
    if (!hasLinkForUrl) {
      const preview = await _fetchLinkPreviewInternal(firstUrl);
      if (preview) {
        const sortOrder = (data.attachments ?? []).length;
        await supabase.from("post_attachments").insert({
          post_id: post.id,
          attachment_type: "link",
          link_url: firstUrl,
          link_title: preview.title,
          link_description: preview.description,
          link_image_url: preview.imageUrl,
          sort_order: sortOrder,
        });
      }
    }
  }

  revalidatePath("/intranet", "layout");
  return { success: true, error: null, postId: post.id };
}

// ─── Edit Post ──────────────────────────────────────────────────────

interface AttachmentInput {
  id?: string;
  attachment_type: string;
  file_url?: string;
  drive_file_id?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  image_width?: number;
  image_height?: number;
  link_url?: string;
  link_title?: string;
  link_description?: string;
  link_image_url?: string;
  [key: string]: unknown;
}

export async function editPost(
  postId: string,
  data: {
    content: string;
    content_json?: TiptapDocument | null;
    attachments?: AttachmentInput[];
  }
): Promise<{ success: boolean; error: string | null; warning?: string }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const content = data.content?.trim();
  if (!content || content.length === 0 || content.length > POST_MAX_LENGTH) {
    return {
      success: false,
      error: `Content must be between 1 and ${POST_MAX_LENGTH.toLocaleString()} characters`,
    };
  }

  // Build update payload — include content_json if provided
  const updatePayload: Record<string, unknown> = { content };
  if (data.content_json !== undefined) {
    updatePayload.content_json = data.content_json;
  }

  // Update post content (author-only via .eq("author_id")).
  // .select().single() ensures we get an error when 0 rows match (non-author),
  // preventing the function from proceeding to attachment operations.
  const { error } = await supabase
    .from("posts")
    .update(updatePayload)
    .eq("id", postId)
    .eq("author_id", user.id)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Post not found or not authorised to edit" };
  }

  // Update mentions if content_json is provided
  if (data.content_json) {
    const mentionIds = extractMentionIds(data.content_json);
    // Delete old mentions and re-insert (diff-based would be more complex for little gain)
    await supabase.from("post_mentions").delete().eq("post_id", postId);
    if (mentionIds.length > 0) {
      await supabase.from("post_mentions").insert(
        mentionIds.map((uid) => ({
          post_id: postId,
          mentioned_user_id: uid,
        }))
      );
      // Note: we don't re-send mention notifications on edit to avoid spam
    }
  }

  // Handle attachment changes if provided
  if (data.attachments !== undefined) {
    const desiredAttachments = (data.attachments ?? []).slice(0, ATTACHMENT_MAX_COUNT);

    // Fetch existing attachments for this post
    const { data: existingAttachments } = await supabase
      .from("post_attachments")
      .select("id, drive_file_id")
      .eq("post_id", postId);

    const existingIds = new Set(
      (existingAttachments ?? []).map((a) => a.id)
    );

    // Validate that any "kept" IDs actually belong to this post
    const keptIds = new Set(
      desiredAttachments
        .filter((a) => a.id && existingIds.has(a.id))
        .map((a) => a.id!)
    );

    // Determine which existing attachments are being removed
    const removedAttachments = (existingAttachments ?? []).filter(
      (a) => !keptIds.has(a.id)
    );

    // Delete only removed attachments (not all — avoids data loss if insert fails)
    const removedIds = removedAttachments.map((a) => a.id);
    if (removedIds.length > 0) {
      await deleteAttachmentFiles(
        removedAttachments.map((a) => a.drive_file_id),
      );

      const { error: deleteError } = await supabase
        .from("post_attachments")
        .delete()
        .in("id", removedIds);

      if (deleteError) {
        return { success: false, error: `Failed to update attachments: ${deleteError.message}` };
      }
    }

    // Update sort_order on kept attachments (parallel for efficiency)
    const updatePromises = desiredAttachments
      .map((att, i) =>
        att.id && keptIds.has(att.id)
          ? supabase.from("post_attachments").update({ sort_order: i }).eq("id", att.id)
          : null
      )
      .filter((p): p is NonNullable<typeof p> => p !== null);

    if (updatePromises.length > 0) {
      const updateResults = await Promise.all(updatePromises);
      const updateError = updateResults.find((r) => r.error)?.error;
      if (updateError) {
        return { success: false, error: `Failed to update attachment order: ${updateError.message}` };
      }
    }

    // Insert only new attachments
    const newAttachments = desiredAttachments
      .map((att, index) => {
        if (att.id && keptIds.has(att.id)) return null; // already exists
        const sanitized: Record<string, unknown> = {
          post_id: postId,
          sort_order: index,
        };
        for (const field of ALLOWED_ATTACHMENT_FIELDS_SHARED) {
          if (field in att && att[field] !== undefined) {
            sanitized[field] = att[field];
          }
        }
        return sanitized;
      })
      .filter((a): a is Record<string, unknown> => a !== null) as Database["public"]["Tables"]["post_attachments"]["Insert"][];

    if (newAttachments.length > 0) {
      const { error: attError } = await supabase
        .from("post_attachments")
        .insert(newAttachments);

      if (attError) {
        revalidatePath("/intranet", "layout");
        return {
          success: true,
          error: null,
          warning: "Post updated, but some attachments could not be saved",
        };
      }
    }

    // Auto-detect first URL in content and create link preview attachment
    const detectedUrls = extractUrls(content);
    if (detectedUrls.length > 0) {
      const firstUrl = detectedUrls[0];
      const hasLinkForUrl = desiredAttachments.some(
        (a) => a.attachment_type === "link" && a.link_url === firstUrl
      );
      if (!hasLinkForUrl) {
        const preview = await _fetchLinkPreviewInternal(firstUrl);
        if (preview) {
          const sortOrder = desiredAttachments.length;
          await supabase.from("post_attachments").insert({
            post_id: postId,
            attachment_type: "link",
            link_url: firstUrl,
            link_title: preview.title,
            link_description: preview.description,
            link_image_url: preview.imageUrl,
            sort_order: sortOrder,
          });
        }
      }
    }
  }

  revalidatePath("/intranet", "layout");
  return { success: true, error: null };
}

export async function deletePost(
  postId: string
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch the post to check ownership
  const { data: post } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  if (!post) {
    return { success: false, error: "Post not found" };
  }

  if (post.author_id !== user.id && !profile.is_hr_admin) {
    return { success: false, error: "Not authorised to delete this post" };
  }

  // Fetch Drive file IDs before deleting the DB record (needed for cleanup)
  const { data: attachments } = await supabase
    .from("post_attachments")
    .select("drive_file_id")
    .eq("post_id", postId);

  // Delete DB record first (cascade handles attachments, reactions, comments).
  // If this fails, file references remain valid. Orphaned Drive files are
  // preferable to broken DB references (orphans can be batch-cleaned later).
  const { error } = await supabase.from("posts").delete().eq("id", postId);

  if (error) {
    logger.error("Failed to delete post", { error });
    return { success: false, error: "Failed to delete post. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  // Clean up Drive files after successful DB delete
  if (attachments && attachments.length > 0) {
    await deleteAttachmentFiles(attachments.map((a) => a.drive_file_id));
  }

  revalidatePath("/intranet", "layout");
  return { success: true, error: null };
}

// ─── Post Fetching ───────────────────────────────────────────────────

export async function getPosts(
  page: number = 1,
  pageSize: number = 10
): Promise<{
  posts: PostWithRelations[];
  hasMore: boolean;
  error: string | null;
}> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { posts: [], hasMore: false, error: "Not authenticated" };
  }

  return fetchPostsWithClient(supabase, user.id, page, pageSize);
}

// ─── Reactions ───────────────────────────────────────────────────────

export async function toggleReaction(
  postId: string,
  reactionType: ReactionType
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  if (!VALID_REACTIONS.includes(reactionType)) {
    return { success: false, error: "Invalid reaction type" };
  }

  // Check if user already has a reaction on this post
  const { data: existing } = await supabase
    .from("post_reactions")
    .select("id, reaction_type")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    if (existing.reaction_type === reactionType) {
      // Same reaction — remove it (toggle off)
      const { error } = await supabase.from("post_reactions").delete().eq("id", existing.id);
      if (error) {
        logger.error("Failed to remove post reaction", { error });
        return { success: false, error: "Failed to update reaction. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
      }
    } else {
      // Different reaction — update
      const { error } = await supabase
        .from("post_reactions")
        .update({ reaction_type: reactionType })
        .eq("id", existing.id);
      if (error) {
        logger.error("Failed to update post reaction", { error });
        return { success: false, error: "Failed to update reaction. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
      }
    }
  } else {
    // No existing reaction — create
    const { error } = await supabase
      .from("post_reactions")
      .insert({ post_id: postId, user_id: user.id, reaction_type: reactionType });
    if (error) {
      logger.error("Failed to add post reaction", { error });
      return { success: false, error: "Failed to update reaction. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
    }
  }

  revalidatePath("/intranet", "layout");
  return { success: true, error: null };
}

// ─── Comment Reactions ────────────────────────────────────────────────

export async function toggleCommentReaction(
  commentId: string,
  reactionType: ReactionType
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  if (!VALID_REACTIONS.includes(reactionType)) {
    return { success: false, error: "Invalid reaction type" };
  }

  // Check if user already has a reaction on this comment
  const { data: existing } = await supabase
    .from("comment_reactions")
    .select("id, reaction_type")
    .eq("comment_id", commentId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    if (existing.reaction_type === reactionType) {
      // Same reaction — remove it (toggle off)
      const { error } = await supabase.from("comment_reactions").delete().eq("id", existing.id);
      if (error) {
        logger.error("Failed to remove comment reaction", { error });
        return { success: false, error: "Failed to update reaction. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
      }
    } else {
      // Different reaction — update
      const { error } = await supabase
        .from("comment_reactions")
        .update({ reaction_type: reactionType })
        .eq("id", existing.id);
      if (error) {
        logger.error("Failed to update comment reaction", { error });
        return { success: false, error: "Failed to update reaction. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
      }
    }
  } else {
    // No existing reaction — create
    const { error } = await supabase
      .from("comment_reactions")
      .insert({ comment_id: commentId, user_id: user.id, reaction_type: reactionType });
    if (error) {
      logger.error("Failed to add comment reaction", { error });
      return { success: false, error: "Failed to update reaction. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
    }
  }

  revalidatePath("/intranet", "layout");
  return { success: true, error: null };
}

// ─── Comments ────────────────────────────────────────────────────────

export async function addComment(
  postId: string,
  content: string,
  parentId?: string,
  contentJson?: TiptapDocument | null
): Promise<{ success: boolean; error: string | null; commentId?: string }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const trimmed = content?.trim();
  if (!trimmed || trimmed.length === 0 || trimmed.length > 2000) {
    return {
      success: false,
      error: "Comment must be between 1 and 2000 characters",
    };
  }

  // If replying, validate parent comment
  if (parentId) {
    const { data: parent } = await supabase
      .from("post_comments")
      .select("id, post_id, parent_id")
      .eq("id", parentId)
      .single();

    if (!parent) {
      return { success: false, error: "Parent comment not found" };
    }

    if (parent.post_id !== postId) {
      return { success: false, error: "Parent comment belongs to a different post" };
    }

    // Enforce single-level threading: no reply-to-reply
    if (parent.parent_id) {
      return { success: false, error: "Cannot reply to a reply" };
    }
  }

  const insertData: Database["public"]["Tables"]["post_comments"]["Insert"] = {
    post_id: postId,
    author_id: user.id,
    content: trimmed,
    ...(parentId ? { parent_id: parentId } : {}),
    ...(contentJson ? { content_json: contentJson as unknown as Json } : {}),
  };

  const { data: comment, error } = await supabase
    .from("post_comments")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to create comment", { error });
    return { success: false, error: "Failed to add comment. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  // Insert mentions and send notifications if content_json contains @mentions
  if (contentJson && comment) {
    const mentionIds = extractMentionIds(contentJson);
    if (mentionIds.length > 0) {
      await supabase.from("comment_mentions").insert(
        mentionIds.map((uid) => ({
          comment_id: comment.id,
          mentioned_user_id: uid,
        }))
      );
      await supabase.rpc("notify_mention", {
        p_mentioned_user_ids: mentionIds,
        p_entity_type: "comment",
        p_entity_id: comment.id,
        p_post_id: postId,
      });

      // Queue mention emails for comments (non-blocking)
      try {
        await sendMentionEmails(supabase, user.id, mentionIds, comment.id, "comment", trimmed, postId);
      } catch (emailErr) {
        logger.error("Failed to queue comment mention emails", { error: emailErr });
      }
    }
  }

  // Send comment/reply notifications (runs after mentions so RPC can deduplicate)
  if (comment) {
    const commentPreview = trimmed.slice(0, 100);
    try {
      await supabase.rpc("notify_post_comment", {
        p_comment_id: comment.id,
        p_post_id: postId,
        p_parent_comment_id: parentId,
        p_comment_preview: commentPreview,
      });
    } catch (err) {
      // Non-critical — don't fail the comment if notification fails
      logger.error("Failed to send comment notification", { error: err });
    }
  }

  revalidatePath("/intranet", "layout");
  return { success: true, error: null, commentId: comment?.id };
}

export async function deleteComment(
  commentId: string
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch the comment to check ownership
  const { data: comment } = await supabase
    .from("post_comments")
    .select("author_id")
    .eq("id", commentId)
    .single();

  if (!comment) {
    return { success: false, error: "Comment not found" };
  }

  if (comment.author_id !== user.id && !profile.is_hr_admin) {
    return { success: false, error: "Not authorised to delete this comment" };
  }

  const { error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    logger.error("Failed to delete comment", { error });
    return { success: false, error: "Failed to delete comment. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/intranet", "layout");
  return { success: true, error: null };
}

// ─── Attachments ─────────────────────────────────────────────────────

export async function uploadPostAttachment(
  formData: FormData,
): Promise<{
  success: boolean;
  error: string | null;
  url?: string;
  driveFileId?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
}> {
  const { user, profile } = await getCurrentUser();

  if (!user || !profile) {
    return { success: false, error: "Not authenticated" };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "No file provided" };
  }

  // Per-type size cap. Images allow up to 100 MB to fit iPhone ProRAW DNGs.
  const isImage = isImageType(file.type);
  const cap = isImage ? IMAGE_MAX_SIZE_BYTES : DOCUMENT_MAX_SIZE_BYTES;
  if (file.size > cap) {
    const limitMB = cap / (1024 * 1024);
    return { success: false, error: `File too large (max ${limitMB} MB)` };
  }

  if (
    !ALLOWED_FILE_TYPES.includes(
      file.type as (typeof ALLOWED_FILE_TYPES)[number],
    )
  ) {
    return { success: false, error: "File type not allowed" };
  }

  const folderId = process.env.GOOGLE_DRIVE_NEWS_FEED_FOLDER_ID;
  if (!folderId) {
    logger.error("GOOGLE_DRIVE_NEWS_FEED_FOLDER_ID is not configured");
    return {
      success: false,
      error: "Upload is temporarily unavailable. Please contact Helpdesk@mcrpathways.org.",
    };
  }

  // Buffer the file for magic-byte validation + Sharp pipeline + Drive upload.
  const buffer = Buffer.from(await file.arrayBuffer());
  const processed = await processUploadedImage(buffer, file.type, file.name);
  if (!processed.ok) {
    return { success: false, error: processed.error };
  }

  // Upload the processed buffer to Drive under YYYY/MM (UTC) subfolders.
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const driveFileName = `${crypto.randomUUID()}-${sanitiseFilename(file.name) || "unnamed"}`;

  try {
    const drive = await uploadFileToDrive(
      processed.buffer,
      processed.mimeType,
      driveFileName,
      { folderId, subfolderPath: [yyyy, mm] },
    );

    return {
      success: true,
      error: null,
      url: `/api/drive-file/${drive.fileId}`,
      driveFileId: drive.fileId,
      fileName: file.name,
      fileSize: processed.buffer.length,
      mimeType: processed.mimeType,
      width: processed.width,
      height: processed.height,
    };
  } catch (err) {
    logger.error("Failed to upload post attachment to Drive", {
      error: err instanceof Error ? err.message : String(err),
      fileName: file.name,
    });
    return {
      success: false,
      error:
        "Failed to upload attachment. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists.",
    };
  }
}

export async function fetchLinkPreview(
  url: string
): Promise<{
  success: boolean;
  error: string | null;
  title?: string;
  description?: string;
  imageUrl?: string;
}> {
  const { user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await _fetchLinkPreviewInternal(url);
  if (!result) {
    return { success: false, error: "Failed to fetch link preview" };
  }

  return {
    success: true,
    error: null,
    title: result.title,
    description: result.description,
    imageUrl: result.imageUrl,
  };
}

// ─── Weekly Round Up ─────────────────────────────────────────────────

export async function getActiveRoundup(): Promise<{
  roundup: ActiveRoundup | null;
  error: string | null;
}> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { roundup: null, error: "Not authenticated" };
  }

  return fetchActiveRoundupWithClient(supabase);
}

export async function getWeeklyRoundups(): Promise<{
  roundups: RoundupListItem[];
  error: string | null;
}> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { roundups: [], error: "Not authenticated" };
  }

  return fetchWeeklyRoundupsWithClient(supabase);
}

export async function getRoundupPosts(
  roundupId: string
): Promise<{
  roundup: WeeklyRoundupBase | null;
  posts: PostWithRelations[];
  error: string | null;
}> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { roundup: null, posts: [], error: "Not authenticated" };
  }

  return fetchRoundupPostsWithClient(supabase, user.id, roundupId);
}

// ─── Mention Picker: Active Profiles ──────────────────────────────────

export interface MentionableUser {
  id: string;
  label: string;
  avatar_url: string | null;
  job_title: string | null;
}

/**
 * Fetches all active profiles for the @mention picker.
 * Returns minimal data (id, display name, avatar, job title).
 * For 80+ users this is a single small query — client-side filtering is instant.
 */
export async function getActiveProfilesForMentions(): Promise<MentionableUser[]> {
  const { supabase, user } = await getCurrentUser();

  if (!user) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name, avatar_url, job_title")
    .eq("status", "active")
    .order("full_name");

  if (!data) return [];

  return data.map((p) => ({
    id: p.id,
    label: p.preferred_name || p.full_name || "User",
    avatar_url: p.avatar_url,
    job_title: p.job_title,
  }));
}

// ─── Comment Editing ─────────────────────────────────────────────────

export async function editComment(
  commentId: string,
  content: string
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const trimmed = content?.trim();
  if (!trimmed || trimmed.length === 0 || trimmed.length > 2000) {
    return {
      success: false,
      error: "Comment must be between 1 and 2,000 characters",
    };
  }

  // RLS enforces author-only update. .select().single() ensures we get an error
  // when 0 rows match (non-author), preventing silent no-ops.
  const { error } = await supabase
    .from("post_comments")
    .update({ content: trimmed, content_json: null })
    .eq("id", commentId)
    .eq("author_id", user.id)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Comment not found or not authorised to edit" };
  }

  // Plain-text edit strips all rich formatting — clear stale mentions
  await supabase
    .from("comment_mentions")
    .delete()
    .eq("comment_id", commentId);

  revalidatePath("/intranet", "layout");
  return { success: true, error: null };
}

// ─── Pin/Unpin Posts (HR Admin only) ─────────────────────────────────

export async function togglePinPost(
  postId: string
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile) {
    return { success: false, error: "Not authenticated" };
  }

  if (!profile.is_hr_admin) {
    return { success: false, error: "Only HR admins can pin or unpin posts" };
  }

  // Fetch current pin state
  const { data: post } = await supabase
    .from("posts")
    .select("is_pinned")
    .eq("id", postId)
    .single();

  if (!post) {
    return { success: false, error: "Post not found" };
  }

  const { error } = await supabase
    .from("posts")
    .update({ is_pinned: !post.is_pinned })
    .eq("id", postId);

  if (error) {
    logger.error("Failed to toggle pin on post", { error });
    return { success: false, error: "Failed to update post pin status. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/intranet", "layout");
  return { success: true, error: null };
}

// ─── Live feed polling ───────────────────────────────────────────────────────

export async function getNewPostCount(
  sinceTimestamp: string
): Promise<number> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .gt("created_at", sinceTimestamp)
    .eq("is_weekly_roundup", false);

  if (error) return 0;
  return count ?? 0;
}

// ─── Poll actions ────────────────────────────────────────────────────────────

export async function votePoll(
  postId: string,
  optionIds: string[]
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  if (optionIds.length === 0) return { success: false, error: "No options selected" };

  // Check poll is still open and get multi-select flag
  const { data: post } = await supabase
    .from("posts")
    .select("poll_question, poll_closes_at, poll_allow_multiple")
    .eq("id", postId)
    .single();

  if (!post) return { success: false, error: "Post not found" };
  if (post.poll_closes_at && new Date(post.poll_closes_at) < new Date()) {
    return { success: false, error: "This poll has closed" };
  }

  // Single-select: only one option allowed
  if (!post.poll_allow_multiple && optionIds.length > 1) {
    return { success: false, error: "This poll only allows a single selection" };
  }

  // Verify all options belong to this post
  const { data: validOptions } = await supabase
    .from("poll_options")
    .select("id")
    .eq("post_id", postId)
    .in("id", optionIds);

  const uniqueOptionIds = new Set(optionIds);
  if (!validOptions || validOptions.length !== uniqueOptionIds.size) {
    return { success: false, error: "One or more poll options are invalid" };
  }
  const filteredIds = Array.from(uniqueOptionIds);

  // Delete existing votes then insert new ones (works for both single and multi-select)
  await supabase
    .from("poll_votes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", user.id);

  const { error } = await supabase.from("poll_votes").insert(
    filteredIds.map((optionId) => ({
      post_id: postId,
      option_id: optionId,
      user_id: user.id,
    }))
  );

  if (error) {
    logger.error("Failed to insert poll vote(s)", { error });
    return { success: false, error: "Failed to submit vote. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/intranet", "layout");
  return { success: true, error: null };
}

export async function removeVote(
  postId: string
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("poll_votes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", user.id);

  if (error) {
    logger.error("Failed to remove poll vote", { error });
    return { success: false, error: "Failed to remove vote. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/intranet", "layout");
  return { success: true, error: null };
}

export async function closePoll(
  postId: string
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) return { success: false, error: "Not authenticated" };

  // Fetch the post to check ownership and poll status
  const { data: post } = await supabase
    .from("posts")
    .select("id, author_id, poll_question, poll_closes_at")
    .eq("id", postId)
    .single();

  if (!post) return { success: false, error: "Post not found" };
  if (!post.poll_question) return { success: false, error: "This post does not have a poll" };

  // Check if already closed
  if (post.poll_closes_at && new Date(post.poll_closes_at) < new Date()) {
    return { success: false, error: "This poll is already closed" };
  }

  // Permission: post author OR systems admin
  const isAuthor = post.author_id === user.id;
  const isSysAdmin = isSystemsAdminEffective(profile);
  if (!isAuthor && !isSysAdmin) {
    return { success: false, error: "You do not have permission to close this poll" };
  }

  const { error } = await supabase
    .from("posts")
    .update({ poll_closes_at: new Date().toISOString() })
    .eq("id", postId);

  if (error) {
    logger.error("Failed to close poll", { error });
    return { success: false, error: "Failed to close poll" };
  }

  revalidatePath("/intranet", "layout");
  return { success: true, error: null };
}

export async function exportPollResults(
  postId: string
): Promise<{
  success: boolean;
  error: string | null;
  data?: {
    question: string;
    allowMultiple: boolean;
    createdAt: string;
    closedAt: string | null;
    options: { text: string; voteCount: number; percentage: number }[];
    totalVoters: number;
    totalActiveStaff: number;
    votes: { voterName: string; optionText: string; votedAt: string }[];
  };
}> {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) return { success: false, error: "Not authenticated" };

  // Fetch post
  const { data: post } = await supabase
    .from("posts")
    .select("id, author_id, poll_question, poll_closes_at, poll_allow_multiple, created_at")
    .eq("id", postId)
    .single();

  if (!post || !post.poll_question) {
    return { success: false, error: "Poll not found" };
  }

  // Check poll is closed
  const isClosed = post.poll_closes_at ? new Date(post.poll_closes_at) < new Date() : false;
  if (!isClosed) {
    return { success: false, error: "Poll must be closed before exporting results" };
  }

  // Permission: author or systems admin
  const isAuthor = post.author_id === user.id;
  const isSysAdmin = isSystemsAdminEffective(profile);
  if (!isAuthor && !isSysAdmin) {
    return { success: false, error: "You do not have permission to export this poll" };
  }

  // Fetch options, votes, and active staff count in parallel
  const [optionsResult, votesResult, staffCountResult] = await Promise.all([
    supabase
      .from("poll_options")
      .select("id, option_text, display_order")
      .eq("post_id", postId)
      .order("display_order"),
    supabase
      .from("poll_votes")
      .select("option_id, user_id, created_at")
      .eq("post_id", postId)
      .order("created_at"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  const optionList = optionsResult.data ?? [];
  const voteList = votesResult.data ?? [];
  const totalActiveStaff = staffCountResult.count ?? 0;

  // Fetch voter profiles
  const voterIds = [...new Set(voteList.map((v) => v.user_id))];
  const voterMap = new Map<string, string>();
  if (voterIds.length > 0) {
    const { data: voters } = await supabase
      .from("profiles")
      .select("id, full_name, preferred_name")
      .in("id", voterIds);
    for (const v of voters ?? []) {
      voterMap.set(v.id, v.preferred_name ?? v.full_name ?? "Unknown");
    }
  }

  // Compute vote counts per option
  const voteCounts = new Map<string, number>();
  for (const v of voteList) {
    voteCounts.set(v.option_id, (voteCounts.get(v.option_id) ?? 0) + 1);
  }

  const totalVoters = voterIds.length;
  const optionMap = new Map(optionList.map((o) => [o.id, o.option_text]));

  return {
    success: true,
    error: null,
    data: {
      question: post.poll_question,
      allowMultiple: post.poll_allow_multiple ?? false,
      createdAt: post.created_at,
      closedAt: post.poll_closes_at,
      options: optionList.map((o) => ({
        text: o.option_text,
        voteCount: voteCounts.get(o.id) ?? 0,
        percentage: totalVoters > 0
          ? Math.round(((voteCounts.get(o.id) ?? 0) / totalVoters) * 100)
          : 0,
      })),
      totalVoters,
      totalActiveStaff,
      votes: voteList.map((v) => ({
        voterName: voterMap.get(v.user_id) ?? "Unknown",
        optionText: optionMap.get(v.option_id) ?? "Unknown option",
        votedAt: v.created_at,
      })),
    },
  };
}
