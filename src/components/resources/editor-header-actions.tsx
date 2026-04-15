"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, FileClock, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateArticleDialog } from "./create-article-dialog";
import { LinkGoogleDocDialog } from "./link-google-doc-dialog";
import { CategoryFormDialog } from "./category-form-dialog";

interface EditorHeaderActionsProps {
  /** Pass-through from the server component: isHRAdmin || isContentEditor. */
  canEdit: boolean;
  /** Draft count for the current editor. Drafts pill hides when 0. */
  draftCount: number;
  /**
   * Pre-scopes "Create Article" and "Link Google Doc" to the current
   * category. Also flips the "New category" item to "New subcategory"
   * (with this category as the parent).
   */
  defaultCategoryId?: string;
}

/**
 * Header-level editor actions for the landing and category pages. Renders
 * nothing for non-editors. No toggle — affordances are always visible to
 * editors. See WS2 plan in ~/.claude/plans/warm-brewing-toucan.md.
 */
export function EditorHeaderActions({
  canEdit,
  draftCount,
  defaultCategoryId,
}: EditorHeaderActionsProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  if (!canEdit) return null;

  const isCategoryScoped = Boolean(defaultCategoryId);

  return (
    <>
      <div className="flex items-center gap-2">
        {draftCount > 0 && (
          <Link
            href="/resources/drafts"
            aria-label={`${draftCount} draft${draftCount === 1 ? "" : "s"} in progress`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800",
              "hover:bg-amber-100 hover:border-amber-300 transition-colors",
              "dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900"
            )}
          >
            <FileClock className="h-3.5 w-3.5" />
            Drafts ({draftCount})
          </Link>
        )}

        <Link
          href="/resources/settings"
          aria-label="Settings"
          title="Settings"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
              Create article
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setLinkOpen(true)}>
              Link Google Doc
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setCategoryOpen(true)}>
              {isCategoryScoped ? "New subcategory" : "New category"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CreateArticleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultCategoryId={defaultCategoryId}
      />
      <LinkGoogleDocDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        defaultCategoryId={defaultCategoryId}
      />
      <CategoryFormDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        defaultParentId={defaultCategoryId}
      />
    </>
  );
}
