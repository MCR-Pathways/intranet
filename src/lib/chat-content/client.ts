import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { ChatDatabase } from "@/types/chat-content";

/**
 * Read-only Supabase client for the external Chat Supabase project.
 *
 * The Chat project owns its own database; the intranet reads published
 * content from it (e.g. courses destined for the intranet hub). This client
 * uses a read-only key against a separate project URL, so it must never be
 * used for writes and must only run server-side.
 *
 * NEVER import this in client components or expose the read-only key.
 */
export function createChatClient() {
  const url = process.env.CHAT_SUPABASE_URL?.trim();
  const key = process.env.CHAT_SUPABASE_READONLY_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Missing Chat Supabase environment variables (CHAT_SUPABASE_URL and CHAT_SUPABASE_READONLY_KEY)",
    );
  }

  return createClient<ChatDatabase>(url, key);
}
