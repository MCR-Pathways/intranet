"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import dns from "node:dns/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReactionType,
  PostWithRelations,
  PostAuthor,
  CommentWithAuthor,
  CommentAuthor,
} from "@/types/database.types";

const POST_SELECT =
  "id, author_id, content, is_pinned, is_weekly_roundup, weekly_roundup_id, created_at, updated_at";
const ATTACHMENT_SELECT =
  "id, post_id, attachment_type, file_url, file_name, file_size, mime_type, link_url, link_title, link_description, link_image_url, sort_order, created_at";
const REACTION_SELECT = "id, post_id, user_id, reaction_type, created_at";
const COMMENT_SELECT =
  "id, post_id, author_id, content, parent_id, created_at, updated_at";
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

// ─── SSRF Protection ──────────────────────────────────────────────────

/**
 * Checks whether an IP address belongs to a private/reserved range.
 * Used to prevent SSRF attacks in fetchLinkPreview.
 */
function isPrivateIP(ip: string): boolean {
  // IPv4
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
    if (parts[0] === 10) return true; // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
    if (parts[0] === 127) return true; // 127.0.0.0/8
    if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 (link-local / cloud metadata)
    if (parts[0] === 0) return true; // 0.0.0.0/8
  }
  // IPv6
  if (ip === "::1") return true; // loopback
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // fc00::/7 ULA
  if (ip.startsWith("fe80")) return true; // link-local
  return false;
}

/**
 * Validates that a URL does not resolve to a private/internal IP address.
 * Prevents SSRF by resolving the hostname and checking the resulting IP.
 */
async function validateExternalUrl(url: string): Promise<boolean> {
  const parsed = new URL(url);
  const hostname = parsed.hostname;

  // If hostname is already an IP, check directly
  if (isPrivateIP(hostname)) return false;

  try {
    const { address } = await dns.lookup(hostname);
    return !isPrivateIP(address);
  } catch {
    return false; // DNS resolution failed; reject
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
    const comment = c as { id: string; post_id: string; author_id: string; content: string; parent_id: string | null; created_at: string; updated_at: string; author: unknown };
    const cReactions = reactionsByComment.get(comment.id) ?? [];
    const userCReaction = cReactions.find((r) => r.user_id === userId);

    return {
      id: comment.id,
      post_id: comment.post_id,
      author_id: comment.author_id,
      content: comment.content,
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
  const postIds = postsSlice.map((p) => p.id);

  if (postIds.length === 0) {
    return { posts: [], hasMore: false, error: null };
  }

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

  const enrichedPosts: PostWithRelations[] = postsSlice.map((post) => {
    const postReactions = reactionsByPost.get(post.id) ?? [];
    const postComments = commentsByPost.get(post.id) ?? [];
    const userReaction = postReactions.find((r) => r.user_id === userId);

    return {
      id: post.id,
      author_id: post.author_id,
      content: post.content,
      is_pinned: post.is_pinned,
      is_weekly_roundup: post.is_weekly_roundup,
      weekly_roundup_id: post.weekly_roundup_id,
      created_at: post.created_at,
      updated_at: post.updated_at,
      author: post.author as unknown as PostAuthor,
      attachments: attachmentsByPost.get(post.id) ?? [],
      reactions: postReactions,
      comments: threadedCommentsByPost.get(post.id) ?? [],
      reaction_counts: buildReactionCounts(postReactions),
      user_reaction: (userReaction?.reaction_type as ReactionType) ?? null,
      comment_count: postComments.length,
    };
  });

  return { posts: enrichedPosts, hasMore, error: null };
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
    return { roundups: [], error: error.message };
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

  if (!posts || posts.length === 0) {
    return {
      roundup: { id: roundup.id, title: roundup.title, summary: roundup.summary, week_start: roundup.week_start, week_end: roundup.week_end },
      posts: [],
      error: null,
    };
  }

  const postIds = posts.map((p) => p.id);

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

  // Batch-fetch ALL comment reactions in a single query
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

  const enrichedPosts: PostWithRelations[] = posts.map((post) => {
    const postReactions = reactionsByPost.get(post.id) ?? [];
    const postComments = commentsByPost.get(post.id) ?? [];
    const userReaction = postReactions.find((r) => r.user_id === userId);

    return {
      id: post.id,
      author_id: post.author_id,
      content: post.content,
      is_pinned: post.is_pinned,
      is_weekly_roundup: post.is_weekly_roundup,
      weekly_roundup_id: post.weekly_roundup_id,
      created_at: post.created_at,
      updated_at: post.updated_at,
      author: post.author as unknown as PostAuthor,
      attachments: attachmentsByPost.get(post.id) ?? [],
      reactions: postReactions,
      comments: threadedCommentsByPost.get(post.id) ?? [],
      reaction_counts: buildReactionCounts(postReactions),
      user_reaction: (userReaction?.reaction_type as ReactionType) ?? null,
      comment_count: postComments.length,
    };
  });

  return {
    roundup: { id: roundup.id, title: roundup.title, summary: roundup.summary, week_start: roundup.week_start, week_end: roundup.week_end },
    posts: enrichedPosts,
    error: null,
  };
}

// ─── Post CRUD ───────────────────────────────────────────────────────

export async function createPost(data: {
  content: string;
  attachments?: {
    attachment_type: "image" | "document" | "link";
    file_url?: string;
    file_name?: string;
    file_size?: number;
    mime_type?: string;
    link_url?: string;
    link_title?: string;
    link_description?: string;
    link_image_url?: string;
  }[];
}): Promise<{ success: boolean; error: string | null; postId?: string; warning?: string }> {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile) {
    return { success: false, error: "Not authenticated" };
  }

  if (profile.user_type !== "staff") {
    return { success: false, error: "Only staff can create posts" };
  }

  const content = data.content?.trim();
  if (!content || content.length === 0 || content.length > 5000) {
    return {
      success: false,
      error: "Content must be between 1 and 5000 characters",
    };
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({ author_id: user.id, content })
    .select("id")
    .single();

  if (postError || !post) {
    return {
      success: false,
      error: postError?.message ?? "Failed to create post",
    };
  }

  // Insert attachments if provided
  if (data.attachments && data.attachments.length > 0) {
    const ALLOWED_ATTACHMENT_FIELDS = [
      "attachment_type",
      "file_url",
      "file_name",
      "file_size",
      "mime_type",
      "link_url",
      "link_title",
      "link_description",
      "link_image_url",
    ] as const;

    const attachments = data.attachments.slice(0, 10).map((att, index) => {
      const sanitized: Record<string, unknown> = {
        post_id: post.id,
        sort_order: index,
      };
      for (const field of ALLOWED_ATTACHMENT_FIELDS) {
        if (field in att && att[field] !== undefined) {
          sanitized[field] = att[field];
        }
      }
      return sanitized;
    });

    const { error: attError } = await supabase
      .from("post_attachments")
      .insert(attachments);

    if (attError) {
      revalidatePath("/intranet");
      return {
        success: true,
        error: null,
        postId: post.id,
        warning: "Post created, but some attachments could not be saved",
      };
    }
  }

  revalidatePath("/intranet");
  return { success: true, error: null, postId: post.id };
}

export async function editPost(
  postId: string,
  data: { content: string }
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const content = data.content?.trim();
  if (!content || content.length === 0 || content.length > 5000) {
    return {
      success: false,
      error: "Content must be between 1 and 5000 characters",
    };
  }

  const { error } = await supabase
    .from("posts")
    .update({ content })
    .eq("id", postId)
    .eq("author_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/intranet");
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
    return { success: false, error: "Not authorized to delete this post" };
  }

  // Delete attachments from storage first
  const { data: attachments } = await supabase
    .from("post_attachments")
    .select("file_url")
    .eq("post_id", postId);

  if (attachments && attachments.length > 0) {
    const filePaths = attachments
      .filter((a) => a.file_url)
      .map((a) => {
        const url = a.file_url!;
        try {
          const parsed = new URL(url);
          const segments = parsed.pathname.split("/post-attachments/");
          if (segments.length < 2 || !segments[1]) return null;
          return segments[1];
        } catch {
          return null;
        }
      })
      .filter((p): p is string => p !== null);

    if (filePaths.length > 0) {
      await supabase.storage.from("post-attachments").remove(filePaths);
    }
  }

  // Cascade delete handles attachments, reactions, comments
  const { error } = await supabase.from("posts").delete().eq("id", postId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/intranet");
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
      await supabase.from("post_reactions").delete().eq("id", existing.id);
    } else {
      // Different reaction — update
      await supabase
        .from("post_reactions")
        .update({ reaction_type: reactionType })
        .eq("id", existing.id);
    }
  } else {
    // No existing reaction — create
    await supabase
      .from("post_reactions")
      .insert({ post_id: postId, user_id: user.id, reaction_type: reactionType });
  }

  revalidatePath("/intranet");
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
      await supabase.from("comment_reactions").delete().eq("id", existing.id);
    } else {
      // Different reaction — update
      await supabase
        .from("comment_reactions")
        .update({ reaction_type: reactionType })
        .eq("id", existing.id);
    }
  } else {
    // No existing reaction — create
    await supabase
      .from("comment_reactions")
      .insert({ comment_id: commentId, user_id: user.id, reaction_type: reactionType });
  }

  revalidatePath("/intranet");
  return { success: true, error: null };
}

// ─── Comments ────────────────────────────────────────────────────────

export async function addComment(
  postId: string,
  content: string,
  parentId?: string
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

  const insertData: { post_id: string; author_id: string; content: string; parent_id?: string } = {
    post_id: postId,
    author_id: user.id,
    content: trimmed,
  };

  if (parentId) {
    insertData.parent_id = parentId;
  }

  const { data: comment, error } = await supabase
    .from("post_comments")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/intranet");
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
    return { success: false, error: "Not authorized to delete this comment" };
  }

  const { error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/intranet");
  return { success: true, error: null };
}

// ─── Attachments ─────────────────────────────────────────────────────

export async function uploadPostAttachment(
  formData: FormData
): Promise<{
  success: boolean;
  error: string | null;
  url?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}> {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile) {
    return { success: false, error: "Not authenticated" };
  }

  if (profile.user_type !== "staff") {
    return { success: false, error: "Only staff can upload attachments" };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "No file provided" };
  }

  if (file.size > 52428800) {
    return { success: false, error: "File too large (max 50MB)" };
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: "File type not allowed" };
  }

  const fileExt = file.name.split(".").pop();
  const uniqueName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `${user.id}/${uniqueName}`;

  const { error: uploadError } = await supabase.storage
    .from("post-attachments")
    .upload(filePath, file);

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("post-attachments").getPublicUrl(filePath);

  return {
    success: true,
    error: null,
    url: publicUrl,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  };
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
  const { user, profile } = await getCurrentUser();

  if (!user || !profile) {
    return { success: false, error: "Not authenticated" };
  }

  if (profile.user_type !== "staff") {
    return { success: false, error: "Only staff can fetch link previews" };
  }

  try {
    // Validate URL
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { success: false, error: "Invalid URL protocol" };
    }

    // SSRF protection: reject URLs that resolve to private/internal IPs
    const isExternal = await validateExternalUrl(url);
    if (!isExternal) {
      return { success: false, error: "URL resolves to a restricted address" };
    }

    const response = await fetch(url, {
      headers: { "User-Agent": "MCR-Intranet-Bot/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to fetch URL" };
    }

    const html = await response.text();

    // Parse Open Graph tags
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
    const imageUrl = getMetaContent("og:image");

    return {
      success: true,
      error: null,
      title: title?.slice(0, 200),
      description: description?.slice(0, 500),
      imageUrl,
    };
  } catch {
    return { success: false, error: "Failed to fetch link preview" };
  }
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
