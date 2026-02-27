import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { fetchRoundupPostsWithClient } from "../../actions";
import { formatShortDate } from "@/lib/utils";
import { PostCard } from "@/components/news-feed/post-card";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import type { PostAuthor } from "@/types/database.types";

interface RoundupDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RoundupDetailPage({
  params,
}: RoundupDetailPageProps) {
  const { id } = await params;
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile) {
    redirect("/login");
  }

  const { roundup, posts, error } = await fetchRoundupPostsWithClient(
    supabase,
    user.id,
    id
  );

  if (!roundup || error) {
    notFound();
  }

  const isHRAdmin = profile.is_hr_admin ?? false;

  const currentUserProfile: PostAuthor = {
    id: profile.id,
    full_name: profile.full_name,
    preferred_name: profile.preferred_name,
    avatar_url: profile.avatar_url,
    job_title: profile.job_title,
  };

  const weekStart = new Date(roundup.week_start);
  const weekEnd = new Date(roundup.week_end);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={roundup.title}
        subtitle={`${formatShortDate(weekStart)} — ${formatShortDate(weekEnd)}, ${weekEnd.getFullYear()}${roundup.summary ? ` · ${roundup.summary}` : ""}`}
        breadcrumbs={[
          { label: "Intranet", href: "/intranet" },
          { label: "Weekly Round Up", href: "/intranet/weekly-roundup" },
          { label: roundup.title },
        ]}
      />

      {/* Posts */}
      {posts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              No posts were shared during this week.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user.id}
              currentUserProfile={currentUserProfile}
              isHRAdmin={isHRAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
