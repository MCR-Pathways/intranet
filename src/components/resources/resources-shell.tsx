"use client";

import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditorModeProvider, useEditorMode } from "./editor-mode-context";

interface ResourcesShellProps {
  canEdit: boolean;
  children: React.ReactNode;
}

export function ResourcesShell({
  canEdit,
  children,
}: ResourcesShellProps) {
  return (
    <EditorModeProvider canEdit={canEdit}>
      <ResourcesShellInner canEdit={canEdit}>
        {children}
      </ResourcesShellInner>
    </EditorModeProvider>
  );
}

function ResourcesShellInner({
  canEdit,
  children,
}: ResourcesShellProps) {
  const { editorMode, toggleEditorMode } = useEditorMode();

  return (
    <div className="space-y-5">
      {/* Editor mode toggle — positioned inline, not floating */}
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

      {/* Content — each page manages its own card surfaces */}
      {children}
    </div>
  );
}
