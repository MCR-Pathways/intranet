"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Star } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { CardActionsKebab } from "./card-actions-kebab";
import {
  toggleArticleFeatured,
  reorderFeaturedArticle,
} from "@/app/(protected)/resources/actions";

interface FeaturedCardActionsProps {
  articleId: string;
  articleTitle: string;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
}

/**
 * Kebab actions for featured-resources cards. Remove-from-featured plus
 * up/down ordering at the MAX_FEATURED_ARTICLES=3 scale (drag-drop deferred
 * to H5). Disabled arrow for first / last position.
 */
export function FeaturedCardActions({
  articleId,
  articleTitle,
  canEdit,
  isFirst,
  isLast,
}: FeaturedCardActionsProps) {
  const [isPending, startTransition] = useTransition();

  if (!canEdit) return null;

  function handleUnfeature() {
    startTransition(async () => {
      const result = await toggleArticleFeatured(articleId);
      if (result.success) {
        toast.success(`"${articleTitle}" removed from featured`);
      } else {
        toast.error(result.error ?? "Failed to unfeature article");
      }
    });
  }

  function handleMove(direction: "up" | "down") {
    startTransition(async () => {
      const result = await reorderFeaturedArticle(articleId, direction);
      if (!result.success) {
        toast.error(result.error ?? "Failed to reorder featured article");
      }
    });
  }

  return (
    <CardActionsKebab triggerLabel={`Actions for ${articleTitle}`}>
      <DropdownMenuItem
        disabled={isFirst || isPending}
        onSelect={() => handleMove("up")}
      >
        <ArrowUp className="h-4 w-4" />
        Move up
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={isLast || isPending}
        onSelect={() => handleMove("down")}
      >
        <ArrowDown className="h-4 w-4" />
        Move down
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={handleUnfeature} disabled={isPending}>
        <Star className="h-4 w-4" />
        Remove from featured
      </DropdownMenuItem>
    </CardActionsKebab>
  );
}
