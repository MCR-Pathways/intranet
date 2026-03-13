import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import { VisibilityBadge } from "./visibility-badge";
import type { CategoryWithCount } from "@/types/database.types";

interface SubcategoryGridProps {
  subcategories: CategoryWithCount[];
  canEdit: boolean;
}

export function SubcategoryGrid({ subcategories, canEdit }: SubcategoryGridProps) {
  if (subcategories.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No subcategories yet"
        description={
          canEdit
            ? "Create subcategories to organise articles within this category."
            : "Subcategories will appear here once created."
        }
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {subcategories.map((sub) => {
        const Icon = resolveIcon(sub.icon);
        const colour = resolveIconColour(sub.icon_colour);

        return (
          <Card
            key={sub.id}
            className="group relative transition-colors hover:bg-muted/50"
          >
            <Link
              href={`/intranet/resources/${sub.slug}`}
              className="absolute inset-0 z-0"
            >
              <span className="sr-only">View {sub.name}</span>
            </Link>
            <CardContent className="flex items-start gap-4 p-5">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  colour.bg,
                  colour.fg
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{sub.name}</h3>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {sub.article_count}{" "}
                    {sub.article_count === 1 ? "article" : "articles"}
                  </Badge>
                  {canEdit && (
                    <VisibilityBadge
                      visibility={sub.visibility as "all" | "internal"}
                    />
                  )}
                </div>
                {sub.description && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {sub.description}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
