import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isLDAdminEffective, isHRAdminEffective } from "@/lib/auth";
import { EntryFeed } from "@/components/tool-shed/entry-feed";
import {
  getEntriesWithClient,
  getPopularTagsWithClient,
} from "./actions";

export default async function ToolShedPage() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const isAdmin =
    isLDAdminEffective(profile) || isHRAdminEffective(profile);

  // Parallel data fetches
  const [entriesResult, popularTags] = await Promise.all([
    getEntriesWithClient(supabase, user.id, 1, 10),
    getPopularTagsWithClient(supabase),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Page header */}
      <div>
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
          <Link href="/learning" className="hover:underline underline-offset-4">
            Learning
          </Link>
          <span className="text-muted-foreground/50 select-none">/</span>
          <span className="text-foreground">Tool Shed</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight">Tool Shed</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Share and discover insights from training events and conferences
        </p>
      </div>

      {/* Feed */}
      <EntryFeed
        initialEntries={entriesResult.entries}
        initialHasMore={entriesResult.hasMore}
        popularTags={popularTags}
        currentUserId={user.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}
