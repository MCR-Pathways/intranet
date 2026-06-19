// Server-only: holds the Chat project read credential. Never import in a client
// component or expose CHAT_SUPABASE_READONLY_KEY to the browser.
import { createClient } from "@supabase/supabase-js";
import type { ChatDatabase } from "@/types/chat-content";

/**
 * Read-only Supabase client for the external Chat Supabase project.
 *
 * The Chat project owns its own database; the intranet reads published content
 * from it (courses destined for the intranet hub). Two credentials are needed:
 * the Chat project's public anon key as the `apikey` header — the Supabase API
 * gateway rejects requests whose apikey isn't a recognised project key — and a
 * server-only JWT minted for the least-privilege `intranet_reader` role as the
 * `Authorization` bearer, which is what scopes reads (via RLS) to published,
 * intranet-destined course content. It must never be used for writes and must
 * only run server-side.
 *
 * NEVER import this in a client component or expose the read-only key.
 */
export function createChatClient() {
  const url = process.env.CHAT_SUPABASE_URL?.trim();
  const anonKey = process.env.CHAT_SUPABASE_ANON_KEY?.trim();
  const readonlyKey = process.env.CHAT_SUPABASE_READONLY_KEY?.trim();

  if (!url || !anonKey || !readonlyKey) {
    throw new Error(
      "Missing Chat Supabase environment variables (CHAT_SUPABASE_URL, CHAT_SUPABASE_ANON_KEY and CHAT_SUPABASE_READONLY_KEY)",
    );
  }

  // apikey = anon key (gateway); Authorization = intranet_reader JWT (role + RLS).
  return createClient<ChatDatabase>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${readonlyKey}` } },
  });
}
