"use client";

import Link from "next/link";
import { Search, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FeaturedResources } from "./featured-resources";
import { AdminBar } from "./admin-bar";
import { formatDate } from "@/lib/utils";
import type { FeaturedArticle } from "@/app/(protected)/resources/actions";

interface RecentArticle {
  id: string;
  title: string;
  slug: string;
  updated_at: string;
  category_name: string;
  category_slug: string;
}

interface ResourcesLandingProps {
  featuredArticles: FeaturedArticle[];
  recentArticles: RecentArticle[];
}

export function ResourcesLanding({
  featuredArticles,
  recentArticles,
}: ResourcesLandingProps) {
  return (
    <div className="space-y-6">
      {/* Admin bar — visible when editor mode on */}
      <AdminBar />

      {/* Hero search — visual only, wired in Sub-PR 5 */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search resources..."
          className="pl-12 py-6 text-[15px] bg-background"
          readOnly
        />
      </div>

      {/* Featured articles */}
      {featuredArticles.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Key Resources
          </h2>
          <FeaturedResources articles={featuredArticles} />
        </section>
      )}

      {/* Recently updated */}
      {recentArticles.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Recently Updated
          </h2>
          <div className="flex flex-col">
            {recentArticles.map((article) => (
              <Link
                key={article.id}
                href={`/resources/article/${article.slug}`}
                className="flex items-center gap-3 px-3.5 py-3 rounded-lg hover:bg-muted transition-colors group"
              >
                <FileText className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-foreground">
                    {article.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {article.category_name}
                    <span className="mx-1.5 text-border">&middot;</span>
                    {formatDate(new Date(article.updated_at))}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
