/**
 * Component registry for resource articles with content_type = 'component'.
 *
 * Each entry maps a component_name (stored in DB) to:
 * - component: React component to render (lazy-loaded)
 * - getData: async function that fetches data for the component (runs server-side)
 *
 * Content editors manage metadata (title, category, visibility) but cannot
 * create component pages — they require a code change + migration to seed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Data fetchers (server-side) ────────────────────────────────────────────

const ORG_CHART_SELECT =
  "id, full_name, job_title, avatar_url, department, region, line_manager_id, status, is_line_manager, is_external, fte";

export async function fetchOrgChartData(
  supabase: SupabaseClient,
  userId: string
) {
  const today = new Date().toISOString().split("T")[0];

  const [{ data: profiles }, { data: onLeaveRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select(ORG_CHART_SELECT)
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("leave_requests")
      .select("profile_id")
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today),
  ]);

  const people = (profiles ?? []).map((p) => ({
    id: p.id as string,
    full_name: p.full_name as string,
    job_title: p.job_title as string | null,
    avatar_url: p.avatar_url as string | null,
    department: p.department as string | null,
    region: p.region as string | null,
    line_manager_id: p.line_manager_id as string | null,
    is_line_manager: (p.is_line_manager as boolean) ?? false,
    is_external: (p.is_external as boolean) ?? false,
    fte: (p.fte as number) ?? 1,
  }));

  const onLeaveIds = new Set(
    (onLeaveRows ?? []).map((r) => r.profile_id as string)
  );

  return {
    people,
    onLeaveIds: Array.from(onLeaveIds),
    currentUserId: userId,
  };
}

// ─── Registry ───────────────────────────────────────────────────────────────

export interface ComponentRegistryEntry {
  /** Async function to fetch component data (runs server-side in the page route) */
  getData: (supabase: SupabaseClient, userId: string) => Promise<unknown>;
}

/**
 * Maps component_name (stored in DB) to its registry entry.
 *
 * To add a new component page:
 * 1. Add an entry here with a getData function
 * 2. Add a dynamic import + entry in COMPONENT_MAP in component-article-view.tsx
 *    (Next.js requires static import paths for code splitting)
 * 3. Seed a migration to create the article record
 */
export const COMPONENT_REGISTRY: Record<string, ComponentRegistryEntry> = {
  "org-chart": {
    getData: fetchOrgChartData,
  },
};
