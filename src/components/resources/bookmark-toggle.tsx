"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleBookmark } from "@/app/(protected)/resources/actions";
import { toast } from "sonner";

interface BookmarkToggleProps {
  articleId: string;
  initialBookmarked: boolean;
}

export function BookmarkToggle({
  articleId,
  initialBookmarked,
}: BookmarkToggleProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    setBookmarked((prev) => !prev);
    startTransition(async () => {
      const result = await toggleBookmark(articleId);
      if (!result.success) {
        setBookmarked((prev) => !prev);
        toast.error(result.error ?? "Failed to update bookmark");
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleToggle}
      disabled={isPending}
      aria-pressed={bookmarked}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark this article"}
      title={bookmarked ? "Remove bookmark" : "Bookmark"}
      className="shrink-0"
    >
      {bookmarked ? (
        <BookmarkCheck className="text-primary" />
      ) : (
        <Bookmark />
      )}
    </Button>
  );
}
