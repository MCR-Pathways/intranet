"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  indexToolShedEntry,
  removeToolShedEntryFromIndex,
} from "@/lib/algolia";
import { toolShedFormatConfig } from "@/lib/learning";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ToolShedFormat,
  PostcardContent,
  ThreeTwoOneContent,
  TakeoverContent,
} from "@/lib/learning";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ToolShedEntryRow {
  id: string;
  user_id: string;
  format: ToolShedFormat;
  title: string;
  content: Record<string, unknown>;
  event_name: string | null;
  event_date: string | null;
  external_course_id: string | null;
  tags: string[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ToolShedAuthor {
  id: string;
  full_name: string;
  preferred_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
}

export interface ToolShedEntryWithAuthor extends ToolShedEntryRow {
  author: ToolShedAuthor;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ENTRY_SELECT =
  "id, user_id, format, title, content, event_name, event_date, tags, is_published, created_at, updated_at";
const AUTHOR_SELECT = "id, full_name, preferred_name, avatar_url, job_title";

const VALID_FORMATS: ToolShedFormat[] = ["postcard", "three_two_one", "takeover"];

const PAGE_SIZE = 10;

// ─── Algolia helpers ────────────────────────────────────────────────────────

/** Flatten JSONB content into a single plaintext string for Algolia search. */
function flattenContent(
  format: ToolShedFormat,
  content: unknown
): string {
  const c = content as Record<string, unknown>;
  switch (format) {
    case "postcard":
      return [
        c.elevator_pitch,
        c.lightbulb_moment,
        c.programme_impact,
        c.golden_nugget,
      ]
        .filter((v): v is string => typeof v === "string")
        .join(" ");
    case "three_two_one":
      return [
        ...((c.three_learned as string[] | undefined) ?? []),
        ...((c.two_changes as string[] | undefined) ?? []),
        typeof c.one_question === "string" ? c.one_question : "",
      ]
        .filter(Boolean)
        .join(" ");
    case "takeover":
      return ((c.useful_things as string[] | undefined) ?? [])
        .filter(Boolean)
        .join(" ");
    default:
      return "";
  }
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validatePostcardContent(
  content: Record<string, unknown>
): { valid: true; data: PostcardContent } | { valid: false; error: string } {
  const fields = ["elevator_pitch", "lightbulb_moment", "programme_impact", "golden_nugget"] as const;
  const data: Record<string, string> = {};

  for (const field of fields) {
    const val = content[field];
    if (typeof val !== "string" || !val.trim()) {
      return { valid: false, error: `${field.replace(/_/g, " ")} is required` };
    }
    if (val.length > 500) {
      return { valid: false, error: `${field.replace(/_/g, " ")} must be 500 characters or fewer` };
    }
    data[field] = val.trim();
  }

  return { valid: true, data: data as unknown as PostcardContent };
}

function validateThreeTwoOneContent(
  content: Record<string, unknown>
): { valid: true; data: ThreeTwoOneContent } | { valid: false; error: string } {
  const { three_learned, two_changes, one_question } = content;

  if (!Array.isArray(three_learned) || three_learned.length !== 3) {
    return { valid: false, error: "Please provide exactly 3 things you learned" };
  }
  for (const item of three_learned) {
    if (typeof item !== "string" || !item.trim()) {
      return { valid: false, error: "All 3 'things learned' fields are required" };
    }
    if (item.length > 300) {
      return { valid: false, error: "Each 'thing learned' must be 300 characters or fewer" };
    }
  }

  if (!Array.isArray(two_changes) || two_changes.length !== 2) {
    return { valid: false, error: "Please provide exactly 2 things you will change" };
  }
  for (const item of two_changes) {
    if (typeof item !== "string" || !item.trim()) {
      return { valid: false, error: "Both 'things to change' fields are required" };
    }
    if (item.length > 300) {
      return { valid: false, error: "Each 'thing to change' must be 300 characters or fewer" };
    }
  }

  if (typeof one_question !== "string" || !one_question.trim()) {
    return { valid: false, error: "The question field is required" };
  }
  if (one_question.length > 500) {
    return { valid: false, error: "The question must be 500 characters or fewer" };
  }

  return {
    valid: true,
    data: {
      three_learned: three_learned.map((s: string) => s.trim()),
      two_changes: two_changes.map((s: string) => s.trim()),
      one_question: one_question.trim(),
    },
  };
}

function validateTakeoverContent(
  content: Record<string, unknown>
): { valid: true; data: TakeoverContent } | { valid: false; error: string } {
  const { useful_things } = content;

  if (!Array.isArray(useful_things) || useful_things.length !== 3) {
    return { valid: false, error: "Please provide exactly 3 useful things" };
  }
  for (const item of useful_things) {
    if (typeof item !== "string" || !item.trim()) {
      return { valid: false, error: "All 3 'useful things' fields are required" };
    }
    if (item.length > 500) {
      return { valid: false, error: "Each 'useful thing' must be 500 characters or fewer" };
    }
  }

  return {
    valid: true,
    data: { useful_things: useful_things.map((s: string) => s.trim()) },
  };
}

function validateContent(
  format: ToolShedFormat,
  content: Record<string, unknown>
): { valid: true; data: PostcardContent | ThreeTwoOneContent | TakeoverContent } | { valid: false; error: string } {
  switch (format) {
    case "postcard":
      return validatePostcardContent(content);
    case "three_two_one":
      return validateThreeTwoOneContent(content);
    case "takeover":
      return validateTakeoverContent(content);
    default:
      return { valid: false, error: "Invalid format" };
  }
}

function validateTags(tags: unknown): { valid: true; data: string[] } | { valid: false; error: string } {
  if (!Array.isArray(tags)) {
    return { valid: true, data: [] };
  }
  if (tags.length > 5) {
    return { valid: false, error: "Maximum 5 tags allowed" };
  }
  const cleaned: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) continue;
    if (trimmed.length > 30) {
      return { valid: false, error: `Tag "${trimmed}" must be 30 characters or fewer` };
    }
    if (!cleaned.includes(trimmed)) {
      cleaned.push(trimmed);
    }
  }
  return { valid: true, data: cleaned };
}

function generateTitle(format: ToolShedFormat, eventName: string | null): string {
  const prefix: Record<ToolShedFormat, { withEvent: string; withoutEvent: string }> = {
    postcard: { withEvent: "Digital Postcard", withoutEvent: "Digital Postcard" },
    three_two_one: { withEvent: "3-2-1", withoutEvent: "3-2-1 Reflection" },
    takeover: { withEvent: "10-Minute Takeover", withoutEvent: "10-Minute Takeover" },
  };

  const config = prefix[format];
  if (eventName?.trim()) {
    return `${config.withEvent}: ${eventName.trim()}`;
  }
  return config.withoutEvent;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isAdmin(profile: { is_hr_admin?: boolean; is_ld_admin?: boolean; status?: string } | null): boolean {
  if (!profile || profile.status !== "active") return false;
  return profile.is_ld_admin === true || profile.is_hr_admin === true;
}

const UNKNOWN_AUTHOR: ToolShedAuthor = {
  id: "",
  full_name: "Unknown",
  preferred_name: null,
  avatar_url: null,
  job_title: null,
};

/**
 * Batch-fetch profiles for a set of entries.
 * The tool_shed_entries FK points to auth.users, not profiles,
 * so PostgREST can't join them directly. We fetch separately.
 */
async function fetchAuthorProfiles(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, ToolShedAuthor>> {
  if (userIds.length === 0) return new Map();

  const { data } = await supabase
    .from("profiles")
    .select(AUTHOR_SELECT)
    .in("id", userIds);

  const map = new Map<string, ToolShedAuthor>();
  if (data) {
    for (const row of data as ToolShedAuthor[]) {
      map.set(row.id, row);
    }
  }
  return map;
}

function attachAuthors(
  rows: ToolShedEntryRow[],
  authorMap: Map<string, ToolShedAuthor>
): ToolShedEntryWithAuthor[] {
  return rows.map((row) => ({
    ...row,
    author: authorMap.get(row.user_id) ?? UNKNOWN_AUTHOR,
  }));
}

// ─── Read Actions ───────────────────────────────────────────────────────────

export async function getEntriesWithClient(
  supabase: SupabaseClient,
  userId: string,
  page: number = 1,
  pageSize: number = PAGE_SIZE,
  format?: ToolShedFormat | null,
  search?: string | null,
  tag?: string | null
): Promise<{ entries: ToolShedEntryWithAuthor[]; hasMore: boolean; error: string | null }> {
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("tool_shed_entries")
    .select(ENTRY_SELECT)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize); // fetch pageSize + 1 to detect hasMore

  // Filter: published OR own entries (RLS handles visibility but we also filter)
  query = query.or(`is_published.eq.true,user_id.eq.${userId}`);

  if (format && VALID_FORMATS.includes(format)) {
    query = query.eq("format", format);
  }

  if (tag?.trim()) {
    query = query.contains("tags", [tag.trim().toLowerCase()]);
  }

  if (search?.trim()) {
    // Sanitise search query — remove special Supabase/PostgREST filter characters
    // Commas and periods are PostgREST .or() separators/operators
    const q = search.trim().replace(/[%_\\,.()"']/g, "");
    if (q) {
      query = query.or(`title.ilike.%${q}%,event_name.ilike.%${q}%,search_text.ilike.%${q}%`);
    }
  }

  const { data, error } = await query;

  if (error) {
    logger.error("Failed to fetch tool shed entries", { error });
    return { entries: [], hasMore: false, error: "Failed to load insights" };
  }

  const rows = (data ?? []) as unknown as ToolShedEntryRow[];
  const hasMore = rows.length > pageSize;
  const sliced = rows.slice(0, pageSize);

  // Batch-fetch author profiles (separate query — FK goes via auth.users)
  const userIds = [...new Set(sliced.map((r) => r.user_id))];
  const authorMap = await fetchAuthorProfiles(supabase, userIds);
  const entries = attachAuthors(sliced, authorMap);

  return { entries, hasMore, error: null };
}

export async function getEntries(
  page: number = 1,
  pageSize: number = PAGE_SIZE,
  format?: ToolShedFormat | null,
  search?: string | null,
  tag?: string | null
): Promise<{ entries: ToolShedEntryWithAuthor[]; hasMore: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return { entries: [], hasMore: false, error: "Not authenticated" };

  return getEntriesWithClient(supabase, user.id, page, pageSize, format, search, tag);
}

export async function getPopularTagsWithClient(
  supabase: SupabaseClient,
  limit: number = 20
): Promise<string[]> {
  const { data, error } = await supabase
    .rpc("get_popular_tags", { limit_count: limit });

  if (error || !data) {
    logger.error("Failed to fetch popular tags", { error });
    return [];
  }

  return data.map((row: { tag: string; usage_count: number }) => row.tag);
}

export async function getEventSuggestions(
  query: string
): Promise<{ suggestions: string[]; error: string | null }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return { suggestions: [], error: "Not authenticated" };

  const q = query.trim().replace(/[%_\\]/g, "");
  if (!q) return { suggestions: [], error: null };

  const { data, error } = await supabase
    .from("tool_shed_entries")
    .select("event_name")
    .ilike("event_name", `%${q}%`)
    .not("event_name", "is", null)
    .limit(20);

  if (error) {
    logger.error("Failed to fetch event suggestions", { error });
    return { suggestions: [], error: "Failed to load suggestions" };
  }

  // Deduplicate
  const unique = [...new Set(
    (data as { event_name: string }[]).map((r) => r.event_name)
  )].slice(0, 10);

  return { suggestions: unique, error: null };
}

export async function getToolShedStats(): Promise<{
  totalEntries: number;
  thisMonthCount: number;
  recentTitles: string[];
}> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return { totalEntries: 0, thisMonthCount: 0, recentTitles: [] };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ count: totalEntries }, { count: thisMonthCount }, { data: recent }] =
    await Promise.all([
      supabase
        .from("tool_shed_entries")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true),
      supabase
        .from("tool_shed_entries")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true)
        .gte("created_at", startOfMonth),
      supabase
        .from("tool_shed_entries")
        .select("title")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(2),
    ]);

  return {
    totalEntries: totalEntries ?? 0,
    thisMonthCount: thisMonthCount ?? 0,
    recentTitles: (recent as { title: string }[] | null)?.map((r) => r.title) ?? [],
  };
}

// ─── Write Actions ──────────────────────────────────────────────────────────

export async function createEntry(data: {
  format: string;
  content: Record<string, unknown>;
  event_name?: string | null;
  event_date?: string | null;
  tags?: string[];
  is_published?: boolean;
}): Promise<{ success: boolean; error: string | null; entryId?: string }> {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // Validate format
  const format = data.format as ToolShedFormat;
  if (!VALID_FORMATS.includes(format)) {
    return { success: false, error: "Invalid format" };
  }

  // Validate content
  const contentResult = validateContent(format, data.content);
  if (!contentResult.valid) {
    return { success: false, error: contentResult.error };
  }

  // Validate tags
  const tagsResult = validateTags(data.tags);
  if (!tagsResult.valid) {
    return { success: false, error: tagsResult.error };
  }

  // Validate event_name
  const eventName = data.event_name?.trim() || null;
  if (eventName && eventName.length > 200) {
    return { success: false, error: "Event name must be 200 characters or fewer" };
  }

  // Validate event_date
  let eventDate: string | null = null;
  if (data.event_date) {
    const parsed = new Date(data.event_date);
    if (isNaN(parsed.getTime())) {
      return { success: false, error: "Invalid event date" };
    }
    eventDate = data.event_date;
  }

  const title = generateTitle(format, eventName);

  const searchText = flattenContent(format, contentResult.data);

  const { data: entry, error } = await supabase
    .from("tool_shed_entries")
    .insert({
      user_id: user.id,
      format,
      title,
      content: contentResult.data,
      event_name: eventName,
      event_date: eventDate,
      tags: tagsResult.data,
      is_published: data.is_published !== false,
      search_text: searchText,
    })
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to create tool shed entry", { error });
    return { success: false, error: "Failed to share insight" };
  }

  // Index in Algolia if published (non-critical)
  if (data.is_published !== false) {
    try {
      const formatConf = toolShedFormatConfig[format];
      const authorName =
        profile?.preferred_name || profile?.full_name || "Unknown";
      await indexToolShedEntry(
        entry.id,
        title,
        format,
        formatConf?.label ?? format,
        eventName,
        tagsResult.data,
        flattenContent(format, contentResult.data),
        authorName,
        new Date().toISOString()
      );
    } catch {
      // Non-critical
    }
  }

  revalidatePath("/learning/tool-shed");
  revalidatePath("/learning");

  return { success: true, error: null, entryId: entry.id };
}

export async function updateEntry(
  id: string,
  data: {
    format?: string;
    content?: Record<string, unknown>;
    event_name?: string | null;
    event_date?: string | null;
    tags?: string[];
    is_published?: boolean;
  }
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // Fetch existing entry to check ownership
  const { data: existing, error: fetchError } = await supabase
    .from("tool_shed_entries")
    .select("id, user_id, format, event_name")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return { success: false, error: "Insight not found" };
  }

  if (existing.user_id !== user.id && !isAdmin(profile)) {
    return { success: false, error: "You can only edit your own insights" };
  }

  // Build update object with whitelisted fields
  const update: Record<string, unknown> = {};

  // If format is being changed, validate it
  const format = (data.format as ToolShedFormat) ?? existing.format;
  if (data.format) {
    if (!VALID_FORMATS.includes(format)) {
      return { success: false, error: "Invalid format" };
    }
    update.format = format;
  }

  // If content is provided, validate it
  if (data.content) {
    const contentResult = validateContent(format, data.content);
    if (!contentResult.valid) {
      return { success: false, error: contentResult.error };
    }
    update.content = contentResult.data;
    update.search_text = flattenContent(format, contentResult.data);
  }

  // Validate tags if provided
  if (data.tags !== undefined) {
    const tagsResult = validateTags(data.tags);
    if (!tagsResult.valid) {
      return { success: false, error: tagsResult.error };
    }
    update.tags = tagsResult.data;
  }

  // Validate event_name
  if (data.event_name !== undefined) {
    const eventName = data.event_name?.trim() || null;
    if (eventName && eventName.length > 200) {
      return { success: false, error: "Event name must be 200 characters or fewer" };
    }
    update.event_name = eventName;
  }

  // Validate event_date
  if (data.event_date !== undefined) {
    if (data.event_date) {
      const parsed = new Date(data.event_date);
      if (isNaN(parsed.getTime())) {
        return { success: false, error: "Invalid event date" };
      }
      update.event_date = data.event_date;
    } else {
      update.event_date = null;
    }
  }

  // Published toggle
  if (data.is_published !== undefined) {
    update.is_published = data.is_published;
  }

  // Re-generate title if format or event_name changed
  const newEventName = (update.event_name as string | null | undefined) ?? existing.event_name;
  const newFormat = (update.format as ToolShedFormat | undefined) ?? existing.format;
  if (update.format !== undefined || update.event_name !== undefined) {
    update.title = generateTitle(newFormat, newEventName);
  }

  if (Object.keys(update).length === 0) {
    return { success: true, error: null };
  }

  const { error } = await supabase
    .from("tool_shed_entries")
    .update(update)
    .eq("id", id);

  if (error) {
    logger.error("Failed to update tool shed entry", { error, id });
    return { success: false, error: "Failed to update insight" };
  }

  // Update Algolia index (non-critical)
  try {
    const isPublished =
      data.is_published !== undefined ? data.is_published : true;

    if (isPublished) {
      // Re-fetch updated entry to get all current fields
      const { data: updated } = await supabase
        .from("tool_shed_entries")
        .select(ENTRY_SELECT)
        .eq("id", id)
        .single();

      if (updated) {
        const entryFormat = updated.format as ToolShedFormat;
        const formatConf = toolShedFormatConfig[entryFormat];
        const authorName =
          profile?.preferred_name || profile?.full_name || "Unknown";
        await indexToolShedEntry(
          id,
          updated.title,
          entryFormat,
          formatConf?.label ?? entryFormat,
          updated.event_name,
          updated.tags as string[],
          flattenContent(
            entryFormat,
            updated.content as Record<string, unknown>
          ),
          authorName,
          updated.updated_at
        );
      }
    } else {
      await removeToolShedEntryFromIndex(id);
    }
  } catch {
    // Non-critical
  }

  revalidatePath("/learning/tool-shed");
  revalidatePath("/learning");

  return { success: true, error: null };
}

export async function deleteEntry(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // Fetch entry to check ownership
  const { data: existing, error: fetchError } = await supabase
    .from("tool_shed_entries")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return { success: false, error: "Insight not found" };
  }

  if (existing.user_id !== user.id && !isAdmin(profile)) {
    return { success: false, error: "You can only delete your own insights" };
  }

  const { error } = await supabase
    .from("tool_shed_entries")
    .delete()
    .eq("id", id);

  if (error) {
    logger.error("Failed to delete tool shed entry", { error, id });
    return { success: false, error: "Failed to delete insight" };
  }

  // Remove from Algolia (non-critical)
  try {
    await removeToolShedEntryFromIndex(id);
  } catch {
    // Non-critical
  }

  revalidatePath("/learning/tool-shed");
  revalidatePath("/learning");

  return { success: true, error: null };
}
