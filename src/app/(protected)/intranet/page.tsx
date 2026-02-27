import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { PostComposer } from "@/components/news-feed/post-composer";
import { PostFeed } from "@/components/news-feed/post-feed";
import { WeeklyRoundupBanner } from "@/components/news-feed/weekly-roundup-banner";
import { fetchPostsWithClient, fetchActiveRoundupWithClient, getActiveProfilesForMentions } from "./actions";
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

  // Fetch initial posts, active roundup, and mention users using the existing supabase client
  // (avoids creating multiple concurrent auth sessions that cause SSR hangs)
  const [postsResult, roundupResult, mentionUsers] = await Promise.all([
    fetchPostsWithClient(supabase, user.id, 1, 10),
    fetchActiveRoundupWithClient(supabase),
    getActiveProfilesForMentions(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="News Feed"
        subtitle="Stay updated with the latest news and announcements"
      />

      {/* Post composer — staff only */}
      {isStaff && <PostComposer userProfile={currentUserProfile} mentionUsers={mentionUsers} />}

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
        mentionUsers={mentionUsers}
      />
    </div>
  );
}
