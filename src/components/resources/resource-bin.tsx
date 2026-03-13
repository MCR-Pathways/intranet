"use client";

import { useTransition } from "react";
import { Trash2, RotateCcw, FileText, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  restoreArticle,
  restoreCategory,
  permanentlyDeleteArticle,
  permanentlyDeleteCategory,
} from "@/app/(protected)/resources/actions";
import { toast } from "sonner";
import { timeAgo } from "@/lib/utils";
import type { ArticleWithAuthor, ResourceCategory } from "@/types/database.types";

interface ResourceBinProps {
  articles: (ArticleWithAuthor & { category_name?: string })[];
  categories: ResourceCategory[];
}

export function ResourceBin({ articles, categories }: ResourceBinProps) {
  return (
    <Tabs defaultValue="articles">
      <TabsList variant="line">
        <TabsTrigger value="articles">
          Articles ({articles.length})
        </TabsTrigger>
        <TabsTrigger value="categories">
          Categories ({categories.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="articles">
        {articles.length === 0 ? (
          <EmptyState
            icon={Trash2}
            title="No deleted articles"
            description="Articles you delete will appear here for 30 days before being permanently removed."
          />
        ) : (
          <div className="space-y-2 mt-4">
            {articles.map((article) => (
              <BinArticleRow key={article.id} article={article} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="categories">
        {categories.length === 0 ? (
          <EmptyState
            icon={Trash2}
            title="No deleted categories"
            description="Categories you delete will appear here for 30 days before being permanently removed."
          />
        ) : (
          <div className="space-y-2 mt-4">
            {categories.map((category) => (
              <BinCategoryRow key={category.id} category={category} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

// ─── Article row ────────────────────────────────────────────────────────────

function BinArticleRow({
  article,
}: {
  article: ArticleWithAuthor & { category_name?: string };
}) {
  const [isPending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreArticle(article.id);
      if (result.success) {
        toast.success("Article restored");
      } else {
        toast.error(result.error ?? "Failed to restore article");
      }
    });
  }

  function handlePermanentDelete() {
    startTransition(async () => {
      const result = await permanentlyDeleteArticle(article.id);
      if (result.success) {
        toast.success("Article permanently deleted");
      } else {
        toast.error(result.error ?? "Failed to permanently delete article");
      }
    });
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{article.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {article.category_name && <span>{article.category_name}</span>}
          {article.deleted_at && (
            <>
              <span>&middot;</span>
              <span>Deleted {timeAgo(article.deleted_at)}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRestore}
          disabled={isPending}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Restore
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete forever
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Permanently delete {article.title}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The article will be permanently
                removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handlePermanentDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ─── Category row ───────────────────────────────────────────────────────────

function BinCategoryRow({
  category,
}: {
  category: ResourceCategory;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreCategory(category.id);
      if (result.success) {
        toast.success("Category restored");
      } else {
        toast.error(result.error ?? "Failed to restore category");
      }
    });
  }

  function handlePermanentDelete() {
    startTransition(async () => {
      const result = await permanentlyDeleteCategory(category.id);
      if (result.success) {
        toast.success("Category permanently deleted");
      } else {
        toast.error(result.error ?? "Failed to permanently delete category");
      }
    });
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Folder className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{category.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {category.description && (
            <span className="truncate">{category.description}</span>
          )}
          {category.deleted_at && (
            <>
              {category.description && <span>&middot;</span>}
              <span>Deleted {timeAgo(category.deleted_at)}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRestore}
          disabled={isPending}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Restore
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete forever
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Permanently delete {category.name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The category will be permanently
                removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handlePermanentDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
