import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, isHRAdminEffective, isSystemsAdminEffective } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { PostPageClient } from "./post-page-client";
import { fetchPostByIdWithClient, getActiveProfilesForMentions } from "../../actions";
import { ArrowLeft } from "lucide-react";
import type { PostAuthor } from "@/types/database.types";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return { title: "Post" };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile) {
    redirect("/login");
  }

  const [post, mentionUsers] = await Promise.all([
    fetchPostByIdWithClient(supabase, user.id, id),
    getActiveProfilesForMentions(),
  ]);

  if (!post) {
    return (
      <div className="mx-auto max-w-[590px] space-y-6">
        <PageHeader title="Post" subtitle="View a specific post" />
        <div className="rounded-xl bg-card p-8 text-center shadow-md">
          <p className="text-muted-foreground">
            This post is no longer available. It may have been deleted.
          </p>
          <Link
            href="/intranet"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to News Feed
          </Link>
        </div>
      </div>
    );
  }

  const isHRAdmin = isHRAdminEffective(profile);
  const isSystemsAdmin = isSystemsAdminEffective(profile);

  const currentUserProfile: PostAuthor = {
    id: profile.id,
    full_name: profile.full_name,
    preferred_name: profile.preferred_name,
    avatar_url: profile.avatar_url,
    job_title: profile.job_title,
  };

  return (
    <div className="mx-auto max-w-[590px] space-y-4">
      <Link
        href="/intranet"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to News Feed
      </Link>

      <PostPageClient
        post={post}
        currentUserId={user.id}
        currentUserProfile={currentUserProfile}
        isHRAdmin={isHRAdmin}
        isSystemsAdmin={isSystemsAdmin}
        mentionUsers={mentionUsers}
      />
    </div>
  );
}
