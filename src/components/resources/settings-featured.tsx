"use client";

import { useEffect, useState, useTransition } from "react";
import { Star, ArrowUp, ArrowDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  fetchFeaturedArticlesAll,
  toggleArticleFeatured,
  reorderFeaturedArticle,
} from "@/app/(protected)/resources/actions";
import { toast } from "sonner";

interface FeaturedItem {
  id: string;
  title: string;
  slug: string;
  featured_sort_order: number;
  category_name: string;
}

export function SettingsFeatured() {
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetchFeaturedArticlesAll().then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  function handleRemove(id: string) {
    startTransition(async () => {
      const result = await toggleArticleFeatured(id);
      if (result.success) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        toast.success("Article unfeatured");
      } else {
        toast.error(result.error ?? "Failed to update");
      }
    });
  }

  function handleReorder(id: string, direction: "up" | "down") {
    startTransition(async () => {
      const result = await reorderFeaturedArticle(id, direction);
      if (result.success) {
        const data = await fetchFeaturedArticlesAll();
        setItems(data);
      } else {
        toast.error(result.error ?? "Failed to reorder");
      }
    });
  }

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Loading featured articles...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Featured articles appear in the &ldquo;Key Resources&rdquo; section on the landing page. Use the star toggle in article kebab menus to add articles.
      </p>

      {items.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No featured articles"
          description="Feature articles from the article view kebab menu."
        />
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <Star className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.category_name}</div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={index === 0 || isPending}
                  onClick={() => handleReorder(item.id, "up")}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  <span className="sr-only">Move up</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={index === items.length - 1 || isPending}
                  onClick={() => handleReorder(item.id, "down")}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  <span className="sr-only">Move down</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  disabled={isPending}
                  onClick={() => handleRemove(item.id)}
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Remove {item.title}</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
