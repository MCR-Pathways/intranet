"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, ChevronDown, FileEdit, Plus, Settings } from "lucide-react";
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

interface ResourceHeaderActionsProps {
  canEdit: boolean;
  draftCount: number;
  defaultCategoryId?: string;
}

export function ResourceHeaderActions({
  canEdit,
  draftCount,
  defaultCategoryId,
}: ResourceHeaderActionsProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const isCategoryScoped = Boolean(defaultCategoryId);

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Bookmarks — all users */}
        <Button variant="outline" size="sm" className="bg-card" asChild>
          <Link href="/resources/bookmarks">
            <Bookmark className="h-3.5 w-3.5 text-mcr-teal" />
            Bookmarks
          </Link>
        </Button>

        {/* Editor actions */}
        {canEdit && (
          <>
            {draftCount > 0 && (
              <Button variant="outline" size="sm" className="bg-card" asChild>
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
          </>
        )}
      </div>

      {canEdit && (
        <>
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
      )}
    </>
  );
}
