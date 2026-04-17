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
      size="icon"
      onClick={handleToggle}
      disabled={isPending}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark this article"}
      className="h-8 w-8 shrink-0"
    >
      {bookmarked ? (
        <BookmarkCheck className="h-4 w-4 text-primary" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
    </Button>
  );
}
