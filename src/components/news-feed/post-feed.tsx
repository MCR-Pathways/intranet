"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { PostCard } from "./post-card";
import { getPosts } from "@/app/(protected)/intranet/actions";
import type { PostWithRelations, PostAuthor } from "@/types/database.types";

interface PostFeedProps {
  initialPosts: PostWithRelations[];
  currentUserId: string;
  currentUserProfile: PostAuthor;
  isStaff: boolean;
  isHRAdmin: boolean;
  initialHasMore: boolean;
}

export function PostFeed({
  initialPosts,
  currentUserId,
  currentUserProfile,
  isStaff,
  isHRAdmin,
  initialHasMore,
}: PostFeedProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(2); // Page 1 is initial data
  const [isPending, startTransition] = useTransition();

  // Sync local state when server re-renders after revalidatePath
  useEffect(() => {
    setPosts(initialPosts);
    setHasMore(initialHasMore);
    setPage(2);
  }, [initialPosts, initialHasMore]);

  const handleLoadMore = () => {
    startTransition(async () => {
      const result = await getPosts(page, 10);
      if (result.posts.length > 0) {
        setPosts((prev) => [...prev, ...result.posts]);
        setPage((p) => p + 1);
      }
      setHasMore(result.hasMore);
    });
  };

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground mb-1">
          No posts yet
        </p>
        <p className="text-sm text-muted-foreground">
          {isStaff
            ? "Be the first to share something with the team!"
            : "Check back soon for updates from the team."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          currentUserProfile={currentUserProfile}
          isStaff={isStaff}
          isHRAdmin={isHRAdmin}
        />
      ))}

      {hasMore && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
