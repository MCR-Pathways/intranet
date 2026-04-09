"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, FileText, FolderPlus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEditorMode } from "./editor-mode-context";
import { LinkGoogleDocDialog } from "./link-google-doc-dialog";
import { CreateArticleDialog } from "./create-article-dialog";
import { CategoryFormDialog } from "./category-form-dialog";

export function AdminBar() {
  const { editorMode } = useEditorMode();
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);

  if (!editorMode) return null;

  return (
    <>
      <div className="flex items-center justify-end gap-2 bg-card rounded-lg border border-border px-4 py-2.5 shadow-sm mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              New
              <ChevronDown className="h-3.5 w-3.5 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setShowCreateDialog(true)}>
              <FileText className="h-4 w-4" />
              Create Article
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setShowLinkDialog(true)}>
              <ExternalLink className="h-4 w-4" />
              Link Google Doc
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setShowCategoryDialog(true)}>
              <FolderPlus className="h-4 w-4" />
              New Category
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" asChild>
          <Link href="/resources/settings">
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </Link>
        </Button>
      </div>

      <CreateArticleDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      <LinkGoogleDocDialog
        open={showLinkDialog}
        onOpenChange={setShowLinkDialog}
      />

      <CategoryFormDialog
        open={showCategoryDialog}
        onOpenChange={(open) => {
          if (!open) setShowCategoryDialog(false);
        }}
      />
    </>
  );
}
