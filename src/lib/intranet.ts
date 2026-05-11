/**
 * Shared constants and utilities for the intranet news feed.
 * Used by both client components and server actions.
 */

export const POST_MAX_LENGTH = 5000;

// Per-file caps. Held under Vercel Hobby's 4.5 MB hard limit on serverless
// function request bodies — that limit is platform-level and cannot be
// overridden by `bodySizeLimit` in next.config.ts. Anything bigger gets a
// 413 from Vercel's edge before the function runs.
//
// REVISIT when upgrading to Vercel Pro: raise both to ~100 MB so iPhone ProRAW
// DNGs (40–80 MB) and large screenshots fit. Sharp pipeline already handles
// the bigger files; only the platform cap is the constraint. Tracked in
// memory/news-feed-drive-media-backlog.md.
export const IMAGE_MAX_SIZE_BYTES = 4194304; // 4 MB
export const DOCUMENT_MAX_SIZE_BYTES = 4194304; // 4 MB
/** @deprecated use IMAGE_MAX_SIZE_BYTES or DOCUMENT_MAX_SIZE_BYTES */
export const ATTACHMENT_MAX_SIZE_BYTES = IMAGE_MAX_SIZE_BYTES;

export const ATTACHMENT_MAX_COUNT = 10;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/x-adobe-dng",
  "image/dng",
] as const;

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
] as const;

/** Validate a file before upload. Returns error string or null if valid. */
export function validateFile(file: File): string | null {
  const isImage = isImageType(file.type);
  const cap = isImage ? IMAGE_MAX_SIZE_BYTES : DOCUMENT_MAX_SIZE_BYTES;

  if (file.size > cap) {
    return `"${file.name}" is too large (max 4MB)`;
  }
  if (
    !ALLOWED_FILE_TYPES.includes(
      file.type as (typeof ALLOWED_FILE_TYPES)[number]
    )
  ) {
    return `"${file.name}" has an unsupported file type`;
  }
  return null;
}

/** Check if a MIME type is an image type */
export function isImageType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(
    mimeType as (typeof ALLOWED_IMAGE_TYPES)[number]
  );
}

// ─── Post types (W4) ─────────────────────────────────────────────────

/**
 * Post-type discriminator. Stored as text on `posts.post_type` with a
 * CHECK constraint enforcing this whitelist (migration 00095). Default
 * is "news"; only structurally distinct types appear elsewhere.
 *
 * Tool Shed types are pre-reserved here so W5 (Tool Shed merge into
 * the home feed) is pure rendering work — no schema PR needed.
 */
export const POST_TYPES = {
  NEWS: "news",
  KUDOS: "kudos",
  ANNOUNCEMENT: "announcement",
  TOOL_SHED_POSTCARD: "tool_shed_postcard",
  TOOL_SHED_THREE_TWO_ONE: "tool_shed_three_two_one",
  TOOL_SHED_TAKEOVER: "tool_shed_takeover",
} as const;

export type PostType = (typeof POST_TYPES)[keyof typeof POST_TYPES];

// ─── Kudos categories (W4) ───────────────────────────────────────────

/**
 * Kudos categories. Six total — sized below Hick's-law fall-off (~7)
 * to keep the picker fast. Names humanizer-vetted: no metaphors that
 * require decoding ("steady hand"), no promotional vocab ("champion").
 *
 * Names should read well as a standalone label and in notification
 * copy ("Sarah sent you kudos for [Category]").
 */
export const KUDOS_CATEGORIES = {
  EXTRA_MILE: "Going the extra mile",
  TEAM_PLAYER: "Team player",
  BRIGHT_IDEA: "Bright idea",
  CAME_THROUGH: "Came through",
  ALWAYS_THERE: "Always there",
  THANK_YOU: "Thank you",
} as const;

export type KudosCategory =
  (typeof KUDOS_CATEGORIES)[keyof typeof KUDOS_CATEGORIES];

export const KUDOS_CATEGORY_VALUES: readonly KudosCategory[] = Object.values(
  KUDOS_CATEGORIES,
);

/** Display order for the category picker. */
export const KUDOS_CATEGORY_ORDER: KudosCategory[] = [
  KUDOS_CATEGORIES.EXTRA_MILE,
  KUDOS_CATEGORIES.TEAM_PLAYER,
  KUDOS_CATEGORIES.BRIGHT_IDEA,
  KUDOS_CATEGORIES.CAME_THROUGH,
  KUDOS_CATEGORIES.ALWAYS_THERE,
  KUDOS_CATEGORIES.THANK_YOU,
];

/** Server-side validation. Server actions check this before writing. */
export function isKudosCategory(value: unknown): value is KudosCategory {
  return (
    typeof value === "string" &&
    KUDOS_CATEGORY_VALUES.includes(value as KudosCategory)
  );
}

/** Cap on recipients per kudos. Past 10, it's a bulk announcement, not recognition. */
export const KUDOS_MAX_RECIPIENTS = 10;

/** Cap on the kudos message body. Short forces specificity. */
export const KUDOS_MESSAGE_MAX_LENGTH = 500;

// ─── Announcements (W4b) ─────────────────────────────────────────────

/**
 * Hard cap on how far in the future an announcement can expire.
 * Stops a careless picker click landing on "indefinite-ish" and
 * defeating the scarcity-preserves-signal argument. 90 days lets
 * a long-running campaign run a full quarter without trickery,
 * which is plenty for an 80-staff org.
 */
export const ANNOUNCEMENT_MAX_DURATION_DAYS = 90;

/**
 * Minimum lead-time between "now" and "expiry". An announcement
 * expiring 30 seconds after publish is almost certainly a typo or
 * timezone mistake — reject and force the author to confirm.
 */
export const ANNOUNCEMENT_MIN_DURATION_MINUTES = 30;
