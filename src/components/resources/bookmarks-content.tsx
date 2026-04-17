"use client";

import Link from "next/link";
import { ArrowLeft, Bookmark } from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BookmarkedArticle {
  id: string;
  title: string;
  slug: string;
  updated_at: string;
  category_name: string;
  category_slug: string;
  parent_category_name: string | null;
}

interface BookmarksContentProps {
  articles: BookmarkedArticle[];
}

export function BookmarksContent({ articles }: BookmarksContentProps) {
  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/resources"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Resources
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Bookmarks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Articles you&apos;ve saved for quick access.
        </p>
      </div>

      {articles.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 px-3 text-xs font-medium text-muted-foreground bg-transparent border-b border-border">
                Title
              </TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium text-muted-foreground bg-transparent border-b border-border hidden sm:table-cell">
                Category
              </TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium text-muted-foreground bg-transparent border-b border-border text-right">
                Updated
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.map((article) => {
              const categoryPath = article.parent_category_name
                ? `${article.parent_category_name} / ${article.category_name}`
                : article.category_name;

              return (
                <TableRow key={article.id}>
                  <TableCell className="px-3 py-2 font-medium">
                    <Link
                      href={`/resources/article/${article.slug}`}
                      className="hover:underline underline-offset-4"
                    >
                      {article.title}
                    </Link>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                    {categoryPath}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-muted-foreground text-right whitespace-nowrap">
                    {formatDate(new Date(article.updated_at))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bookmark className="h-10 w-10 mb-3 opacity-15" />
          <p className="text-sm font-medium">No bookmarked articles</p>
          <p className="text-xs mt-1 text-muted-foreground/60">
            Tap the bookmark icon on any article to save it here.
          </p>
        </div>
      )}
    </div>
  );
}
