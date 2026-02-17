import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with service_role privileges.
 * Bypasses RLS — use only in server-side code for system operations
 * like creating notifications for users.
 *
 * NEVER import this in client components or expose the service role key.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase service role environment variables");
  }

  return createClient(url, key);
}
