import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { fetchRoundupPostsWithClient } from "../../actions";
import { formatShortDate } from "@/lib/utils";
import { PostCard } from "@/components/news-feed/post-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
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
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/intranet/weekly-roundup">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          All Round Ups
        </Link>
      </Button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">
            {roundup.title}
          </h1>
        </div>
        <p className="text-muted-foreground mt-1">
          {formatShortDate(weekStart)} — {formatShortDate(weekEnd)},{" "}
          {weekEnd.getFullYear()}
        </p>
        {roundup.summary && (
          <p className="text-muted-foreground mt-1">{roundup.summary}</p>
        )}
      </div>

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
