"use client";

import Link from "next/link";
import { Check, Loader2, AlertTriangle, Save, Send, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface EditorSaveControlsProps {
  saveStatus: SaveStatus;
  onSave: () => void;
  viewHref: string;
  isPublished: boolean;
  onPublishToggle: () => void;
  isPublishPending: boolean;
}

/**
 * Save-status indicator + Save / View / Publish controls for the native
 * article editor. Presentational only — state and handlers live in
 * NativeArticleEditor and are passed in. Rendered inside the sticky editor
 * toolbar via its `rightSlot`.
 */
export function EditorSaveControls({
  saveStatus,
  onSave,
  viewHref,
  isPublished,
  onPublishToggle,
  isPublishPending,
}: EditorSaveControlsProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
      {saveStatus === "saving" && (
        <span className="inline-flex items-center gap-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Saving...
        </span>
      )}
      {saveStatus === "saved" && (
        <span className="inline-flex items-center gap-1 text-emerald-600">
          <Check className="h-3.5 w-3.5" />
          Saved
        </span>
      )}
      {saveStatus === "error" && (
        <span className="inline-flex items-center gap-1 text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          Failed to save — retrying...
        </span>
      )}

      {/* Variants per docs/button-system.md: Save = default (primary commit);
          View / Unpublish = outline (navigation / step-back); Publish =
          success (high-stakes positive). */}
      <Button
        onClick={onSave}
        disabled={saveStatus === "saving" || isPublishPending}
        aria-busy={saveStatus === "saving"}
      >
        <Save />
        Save
      </Button>
      <Button variant="outline" asChild>
        <Link href={viewHref}>View article</Link>
      </Button>
      {isPublished ? (
        <Button
          variant="outline"
          onClick={onPublishToggle}
          disabled={isPublishPending || saveStatus === "saving"}
          aria-busy={isPublishPending}
        >
          <EyeOff />
          Unpublish
        </Button>
      ) : (
        <Button
          variant="success"
          onClick={onPublishToggle}
          disabled={isPublishPending || saveStatus === "saving"}
          aria-busy={isPublishPending}
        >
          <Send />
          Publish
        </Button>
      )}
    </div>
  );
}
