"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PostCard } from "@/components/news-feed/post-card";
import type { PostWithRelations, PostAuthor } from "@/types/database.types";
import type { MentionUser } from "@/components/news-feed/mention-list";

interface PostPageClientProps {
  post: PostWithRelations;
  currentUserId: string;
  currentUserProfile: PostAuthor;
  isHRAdmin: boolean;
  isSystemsAdmin: boolean;
  mentionUsers: MentionUser[];
}

/**
 * Client wrapper for the standalone post page.
 * Handles comment hash scrolling and post deletion redirect.
 */
export function PostPageClient({
  post,
  currentUserId,
  currentUserProfile,
  isHRAdmin,
  isSystemsAdmin,
  mentionUsers,
}: PostPageClientProps) {
  const router = useRouter();

  // Scroll to comment if hash fragment is present (e.g. #comment-UUID)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#comment-")) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.transition = "background-color 0.3s";
          el.style.backgroundColor = "hsl(var(--primary) / 0.08)";
          setTimeout(() => {
            el.style.backgroundColor = "";
          }, 2000);
        }, 100);
      }
    }
  }, []);

  return (
    <PostCard
      post={post}
      currentUserId={currentUserId}
      currentUserProfile={currentUserProfile}
      isHRAdmin={isHRAdmin}
      isSystemsAdmin={isSystemsAdmin}
      mentionUsers={mentionUsers}
      initialCommentsExpanded
      onDeleted={() => router.push("/intranet")}
    />
  );
}
