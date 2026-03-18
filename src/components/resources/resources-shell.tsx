"use client";

import { usePathname } from "next/navigation";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResourceTree } from "./resource-tree";
import { EditorModeProvider, useEditorMode } from "./editor-mode-context";
import type { CategoryTreeNode } from "@/types/database.types";

interface ResourcesShellProps {
  categories: CategoryTreeNode[];
  canEdit: boolean;
  children: React.ReactNode;
}

export function ResourcesShell({
  categories,
  canEdit,
  children,
}: ResourcesShellProps) {
  return (
    <EditorModeProvider canEdit={canEdit}>
      <ResourcesShellInner categories={categories} canEdit={canEdit}>
        {children}
      </ResourcesShellInner>
    </EditorModeProvider>
  );
}

function ResourcesShellInner({
  categories,
  canEdit,
  children,
}: ResourcesShellProps) {
  const pathname = usePathname();
  const { editorMode, toggleEditorMode } = useEditorMode();

  return (
    <div className="space-y-3">
      {/* Editor mode toggle — above the card, matching mockup breadcrumbs row */}
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={toggleEditorMode}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-all",
              editorMode
                ? "bg-mcr-teal text-white border-mcr-teal"
                : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
            )}
          >
            <Pencil className="h-4 w-4" />
            {editorMode ? "Editing" : "Edit"}
          </button>
        </div>
      )}

      {/* Card panel with tree + content */}
      <div
        className="flex bg-card shadow-md rounded-xl overflow-clip"
        style={{ minHeight: "calc(100vh - 14rem)" }}
      >
        <ResourceTree
          categories={categories}
          currentPath={pathname}
          canEdit={canEdit}
        />
        <div className="flex-1 p-6 md:p-7 overflow-y-auto min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
