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

/** Up to two categories per kudos — focused recognition, not a checklist. */
export const KUDOS_MAX_CATEGORIES = 2;

/**
 * "Thank you" is exclusive: it reads with its own connector ("to say thank
 * you", not "for …"), so it never pairs with another category.
 */
export const KUDOS_EXCLUSIVE_CATEGORY: KudosCategory = KUDOS_CATEGORIES.THANK_YOU;

export function isExclusiveKudosCategory(category: string): boolean {
  return category === KUDOS_EXCLUSIVE_CATEGORY;
}

/**
 * Each category carries a sentence fragment the feed renders. The connector
 * ("for" / "to") leads the first fragment; a second fragment joins with "and"
 * and drops its connector. Since "Thank you" (the only "to") is exclusive, the
 * connector always comes from the first — and, for "Thank you", only — category.
 * A new category must supply its own fragment here.
 */
export const KUDOS_CATEGORY_FRAGMENTS: Record<
  KudosCategory,
  { connector: string; body: string }
> = {
  [KUDOS_CATEGORIES.EXTRA_MILE]: { connector: "for", body: "going the extra mile" },
  [KUDOS_CATEGORIES.TEAM_PLAYER]: { connector: "for", body: "being a team player" },
  [KUDOS_CATEGORIES.BRIGHT_IDEA]: { connector: "for", body: "sharing a bright idea" },
  [KUDOS_CATEGORIES.CAME_THROUGH]: { connector: "for", body: "coming through" },
  [KUDOS_CATEGORIES.ALWAYS_THERE]: { connector: "for", body: "always being there" },
  [KUDOS_CATEGORIES.THANK_YOU]: { connector: "to", body: "say thank you" },
};

/**
 * Validate a kudos category selection: 1-2 valid categories, de-duplicated,
 * with "Thank you" only ever on its own. Returns the cleaned list or a
 * user-facing error. The DB CHECK enforces the same shape as defence-in-depth.
 */
export function validateKudosCategories(
  categories: unknown,
): { ok: true; categories: KudosCategory[] } | { ok: false; error: string } {
  if (!Array.isArray(categories) || categories.length === 0) {
    return { ok: false, error: "Pick a category for your kudos." };
  }
  const unique = Array.from(new Set(categories));
  if (unique.length > KUDOS_MAX_CATEGORIES) {
    return { ok: false, error: `Pick up to ${KUDOS_MAX_CATEGORIES} categories.` };
  }
  if (!unique.every(isKudosCategory)) {
    return { ok: false, error: "Pick a valid category for your kudos." };
  }
  const valid = unique as KudosCategory[];
  if (valid.length > 1 && valid.some(isExclusiveKudosCategory)) {
    return {
      ok: false,
      error: `"${KUDOS_EXCLUSIVE_CATEGORY}" can't be combined with another category.`,
    };
  }
  return { ok: true, categories: valid };
}

/** A run of sentence text; `bold` marks the parts the feed renders <strong>. */
export interface KudosSentenceSegment {
  text: string;
  bold?: boolean;
}

/**
 * The kudos headline as ordered segments — bold marks the sender, recipients,
 * and the category bodies. Recipients join with ", " and "and" before the
 * last; a second category joins with "and" after the lead connector. The feed
 * renders the bold segments as <strong>; plain-text surfaces flatten via
 * `kudosSentencePlain`.
 *
 * e.g. **Marc** sent kudos to **Aimee** and **Chris** for **going the extra
 * mile** and **being a team player**
 */
export function buildKudosSentenceParts(
  senderName: string,
  recipientNames: string[],
  categories: KudosCategory[],
): KudosSentenceSegment[] {
  const segments: KudosSentenceSegment[] = [{ text: senderName, bold: true }];
  segments.push({ text: " sent kudos to " });

  recipientNames.forEach((name, i) => {
    if (i > 0) {
      segments.push({ text: i === recipientNames.length - 1 ? " and " : ", " });
    }
    segments.push({ text: name, bold: true });
  });

  const [first, second] = categories;
  if (first) {
    const lead = KUDOS_CATEGORY_FRAGMENTS[first];
    segments.push({ text: ` ${lead.connector} ` });
    segments.push({ text: lead.body, bold: true });
    if (second) {
      segments.push({ text: " and " });
      segments.push({ text: KUDOS_CATEGORY_FRAGMENTS[second].body, bold: true });
    }
  }
  return segments;
}

/** Flatten the headline to plain text (aria-labels, logs). */
export function kudosSentencePlain(
  senderName: string,
  recipientNames: string[],
  categories: KudosCategory[],
): string {
  return buildKudosSentenceParts(senderName, recipientNames, categories)
    .map((s) => s.text)
    .join("");
}

/**
 * Notification title (second person, recipient's view): "Marc sent you kudos
 * for going the extra mile and being a team player" / "…to say thank you".
 * Reuses the fragment connector + body so it tracks the feed wording.
 */
export function kudosNotificationTitle(
  senderName: string,
  categories: KudosCategory[],
): string {
  const [first, second] = categories;
  const lead = first ? KUDOS_CATEGORY_FRAGMENTS[first] : null;
  const tail = lead
    ? ` ${lead.connector} ${lead.body}${
        second ? ` and ${KUDOS_CATEGORY_FRAGMENTS[second].body}` : ""
      }`
    : "";
  return `${senderName} sent you kudos${tail}`;
}
