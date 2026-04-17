"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, FileEdit, Plus, Settings } from "lucide-react";
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
      {/* Order: [Drafts] left (secondary status), [Settings] middle, [+ New] right (primary). */}
      <div className="flex items-center gap-2">
        {draftCount > 0 && (
          <Button variant="outline" size="sm" asChild>
            <Link
              href="/resources/drafts"
              aria-label={`${draftCount} draft${draftCount === 1 ? "" : "s"} in progress`}
            >
              <FileEdit className="h-3.5 w-3.5" />
              Drafts
              <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-muted px-1 text-[10px] font-semibold text-foreground">
                {draftCount}
              </span>
            </Link>
          </Button>
        )}

        <Button variant="ghost" size="icon" asChild>
          <Link href="/resources/settings" aria-label="Settings" title="Settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>

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
