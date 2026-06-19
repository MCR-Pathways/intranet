import { createChatClient } from "@/lib/chat-content/client";
import { logger } from "@/lib/logger";
import type {
  ContentItemWithOptions,
  LoadedContent,
} from "@/types/chat-content";

/**
 * Read-only queries against the external Chat Supabase project.
 *
 * Explicit SELECT constants only — never select('*') — so a column added
 * upstream never silently widens what the intranet reads. Errors are logged
 * via the structured logger and never surfaced raw to callers; list reads
 * fall back to [] and single reads to null.
 */

/** Columns read for the intranet hub course listing. */
const HUB_COURSE_LIST_SELECT =
  "id, title, description, estimated_duration_minutes, target_audience, settings, published_at";

/** Columns read for a single course collection when loading its full content. */
const COLLECTION_SELECT =
  "id, type, title, description, target_audience, status, is_public, settings, updated_at, published_at, source_conversation_id";

/** Columns read for each content item, with nested options. */
const CONTENT_ITEM_OPTION_SELECT =
  "id, item_id, label, value, image_url, sort_order";

const CONTENT_ITEM_SELECT = `id, collection_id, parent_id, type, title, content, is_required, correct_answer, settings, sort_order, options:content_item_options(${CONTENT_ITEM_OPTION_SELECT})`;

export interface IntranetHubCourse {
  id: string;
  title: string;
  description: string | null;
  estimated_duration_minutes: number | null;
  target_audience: string;
  settings: unknown;
  published_at: string | null;
}

/**
 * Lists published courses destined for the intranet hub.
 *
 * Filters: status = 'published', type = 'course', and destinations contains
 * 'intranet'. Returns [] (and logs) on error.
 */
export async function listIntranetHubCourses(): Promise<IntranetHubCourse[]> {
  let supabase: ReturnType<typeof createChatClient>;
  try {
    supabase = createChatClient();
  } catch (err) {
    logger.error("Chat client unavailable for hub course listing", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  const { data, error } = await supabase
    .from("content_collections")
    .select(HUB_COURSE_LIST_SELECT)
    .eq("status", "published")
    .eq("type", "course")
    .contains("destinations", ["intranet"]);

  if (error) {
    logger.error("Failed to list intranet hub courses from Chat project", {
      error: error.message,
    });
    return [];
  }

  return data ?? [];
}

/**
 * Loads a single course collection plus its nested content items (each with
 * options), ordered by sort_order, and maps it to the LoadedContent shape.
 *
 * Returns null (and logs) on error or when the collection is not found.
 */
export async function getHubCourseContent(
  sourceCourseId: string,
): Promise<LoadedContent | null> {
  let supabase: ReturnType<typeof createChatClient>;
  try {
    supabase = createChatClient();
  } catch (err) {
    logger.error("Chat client unavailable for hub course content", {
      error: err instanceof Error ? err.message : String(err),
      sourceCourseId,
    });
    return null;
  }

  const { data, error } = await supabase
    .from("content_collections")
    .select(COLLECTION_SELECT)
    .eq("id", sourceCourseId)
    .maybeSingle();

  if (error) {
    logger.error("Failed to load Chat course collection", {
      error: error.message,
      sourceCourseId,
    });
    return null;
  }

  if (!data) {
    return null;
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from("content_items")
    .select(CONTENT_ITEM_SELECT)
    .eq("collection_id", sourceCourseId)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    logger.error("Failed to load Chat course content items", {
      error: itemsError.message,
      sourceCourseId,
    });
    return null;
  }

  const items: ContentItemWithOptions[] = (itemRows ?? []).map((row) => ({
    id: row.id,
    collection_id: row.collection_id,
    parent_id: row.parent_id,
    type: row.type as ContentItemWithOptions["type"],
    title: row.title,
    content: row.content,
    is_required: row.is_required,
    correct_answer: row.correct_answer,
    settings: (row.settings ?? {}) as Record<string, unknown>,
    sort_order: row.sort_order,
    options: [...(row.options ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  }));

  return {
    collection: {
      id: data.id,
      type: data.type as LoadedContent["collection"]["type"],
      title: data.title,
      description: data.description,
      target_audience:
        data.target_audience as LoadedContent["collection"]["target_audience"],
      status: data.status as LoadedContent["collection"]["status"],
      is_public: data.is_public,
      settings: (data.settings ?? {}) as Record<string, unknown>,
      updated_at: data.updated_at,
      published_at: data.published_at,
      source_conversation_id: data.source_conversation_id,
    },
    items,
  };
}
