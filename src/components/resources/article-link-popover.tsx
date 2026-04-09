"use client";

/**
 * Popover for searching and inserting links to intranet articles.
 *
 * Used alongside Plate's built-in LinkPlugin. The LinkPlugin handles
 * external URLs; this component handles internal article links.
 * Inserts a link node with the article's intranet URL.
 */

import { useCallback, useState } from "react";
import { FileText, Link as LinkIcon, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { searchArticlesForLink } from "@/app/(protected)/resources/native-actions";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";

interface ArticleResult {
  id: string;
  title: string;
  slug: string;
  categorySlug: string;
  parentCategorySlug?: string;
}

interface ArticleLinkPopoverProps {
  /** Called when an article is selected. Receives the intranet URL and title. */
  onInsertLink: (url: string, title: string) => void;
}

export function ArticleLinkPopover({ onInsertLink }: ArticleLinkPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArticleResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useDebouncedCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const data = await searchArticlesForLink(q);
    setResults(data);
    setLoading(false);
  }, 300);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      search(value);
    },
    [search]
  );

  const handleSelect = useCallback(
    (article: ArticleResult) => {
      const articleUrl = `/resources/article/${article.slug}`;
      onInsertLink(articleUrl, article.title);
      setOpen(false);
      setQuery("");
      setResults([]);
    },
    [onInsertLink]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Link to article"
          onMouseDown={(e) => e.preventDefault()}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" sideOffset={8}>
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search articles..."
              className="pl-9 h-9"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No articles found
            </div>
          )}

          {!loading && results.length > 0 && (
            <ul className="py-1">
              {results.map((article) => (
                <li key={article.id}>
                  <button
                    type="button"
                    className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelect(article)}
                  >
                    <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <span className="text-sm leading-snug">{article.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!loading && query.trim().length < 2 && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
