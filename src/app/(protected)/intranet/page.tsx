import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PostComposer } from "@/components/news-feed/post-composer";
import { PostFeed } from "@/components/news-feed/post-feed";
import { WeeklyRoundupBanner } from "@/components/news-feed/weekly-roundup-banner";
import { fetchPostsWithClient, fetchActiveRoundupWithClient } from "./actions";
import type { PostAuthor } from "@/types/database.types";

export default async function IntranetPage() {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile) {
    redirect("/login");
  }

  const isStaff = profile.user_type === "staff";
  const isHRAdmin = profile.is_hr_admin ?? false;

  const currentUserProfile: PostAuthor = {
    id: profile.id,
    full_name: profile.full_name,
    preferred_name: profile.preferred_name,
    avatar_url: profile.avatar_url,
    job_title: profile.job_title,
  };

  // Fetch initial posts and active roundup using the existing supabase client
  // (avoids creating multiple concurrent auth sessions that cause SSR hangs)
  const [postsResult, roundupResult] = await Promise.all([
    fetchPostsWithClient(supabase, user.id, 1, 10),
    fetchActiveRoundupWithClient(supabase),
  ]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">News Feed</h1>
        <p className="text-muted-foreground mt-1">
          Stay updated with the latest news and announcements
        </p>
      </div>

      {/* Post composer — staff only */}
      {isStaff && <PostComposer userProfile={currentUserProfile} />}

      {/* Weekly roundup banner */}
      {roundupResult.roundup && (
        <WeeklyRoundupBanner roundup={roundupResult.roundup} />
      )}

      {/* Post feed */}
      <PostFeed
        initialPosts={postsResult.posts}
        currentUserId={user.id}
        currentUserProfile={currentUserProfile}
        isStaff={isStaff}
        isHRAdmin={isHRAdmin}
        initialHasMore={postsResult.hasMore}
      />
    </div>
  );
}
