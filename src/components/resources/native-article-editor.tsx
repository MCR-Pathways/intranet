"use client";

/**
 * Full-page editor for native Plate articles.
 *
 * Wraps PlateRichEditor with auto-save (5-second debounce),
 * save status indicator, concurrent editing warning, and
 * navigation back to the article view.
 */

import { createElement, useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, AlertTriangle, Save, Send, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlateRichEditor, EMPTY_PLATE_VALUE } from "./plate-editor";
import { PublishConfirmDialog } from "./publish-confirm-dialog";
import {
  saveNativeArticle,
  updateEditingStatus,
  publishNativeArticle,
  unpublishNativeArticle,
} from "@/app/(protected)/resources/native-actions";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import type { Value } from "platejs";
import type { ArticleWithAuthor, ResourceCategory } from "@/types/database.types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface NativeArticleEditorProps {
  article: ArticleWithAuthor;
  category: ResourceCategory;
}

export function NativeArticleEditor({
  article,
  category,
}: NativeArticleEditorProps) {
  const router = useRouter();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [editingWarning, setEditingWarning] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [isPublishPending, startPublishTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const currentValueRef = useRef<Value>(
    ((article as unknown as { content_json?: unknown }).content_json as Value) ?? EMPTY_PLATE_VALUE
  );

  const initialValue = ((article as unknown as { content_json?: unknown }).content_json as Value) ?? EMPTY_PLATE_VALUE;
  const isPublished = article.status === "published";
  const lastPublishedAt = article.last_published_at;

  const iconFg = resolveIconColour(category.icon_colour).fg;

  // Check for concurrent editing on mount
  useEffect(() => {
    updateEditingStatus(article.id).then((result) => {
      if (result.editingBy) {
        setEditingWarning(`${result.editingBy} is currently editing this article.`);
      }
    });
  }, [article.id]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

  const doSave = useCallback(
    async (value: Value) => {
      const json = JSON.stringify(value);
      if (json === lastSavedRef.current) return;

      setSaveStatus("saving");
      const result = await saveNativeArticle(
        article.id,
        value as unknown as Record<string, unknown>[]
      );

      if (result.success) {
        lastSavedRef.current = json;
        setSaveStatus("saved");
        // Also update editing_at to keep the concurrent editing check fresh
        updateEditingStatus(article.id).catch(() => {});
      } else {
        setSaveStatus("error");
        // Retry once after 3 seconds
        retryRef.current = setTimeout(async () => {
          const retry = await saveNativeArticle(
            article.id,
            value as unknown as Record<string, unknown>[]
          );
          if (retry.success) {
            lastSavedRef.current = json;
            setSaveStatus("saved");
          } else {
            toast.error("Unsaved changes — check your connection");
          }
        }, 3000);
      }
    },
    [article.id]
  );

  const clearPendingTimers = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
  }, []);

  const handleChange = useCallback(
    (value: Value) => {
      currentValueRef.current = value;
      clearPendingTimers();
      debounceRef.current = setTimeout(() => doSave(value), 5000);
    },
    [doSave, clearPendingTimers]
  );

  const handleManualSave = useCallback(() => {
    clearPendingTimers();
    doSave(currentValueRef.current);
  }, [doSave, clearPendingTimers]);

  function handlePublishToggle() {
    startPublishTransition(async () => {
      const result = isPublished
        ? await unpublishNativeArticle(article.id)
        : await publishNativeArticle(article.id);
      if (result.success) {
        toast.success(isPublished ? "Article unpublished" : "Article published");
        setPublishOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to update article");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Concurrent editing warning */}
      {editingWarning && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {editingWarning}
        </div>
      )}

      {/* Published article warning */}
      {isPublished && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
          This article is live — changes are visible immediately.
          {lastPublishedAt && (
            <span className="text-muted-foreground">
              Last published {formatDate(new Date(lastPublishedAt))}
            </span>
          )}
        </div>
      )}

      {/* Header with breadcrumbs + save status */}
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link
            href={`/resources/article/${article.slug}`}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to article
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="inline-flex items-center gap-1.5">
            {createElement(resolveIcon(category.icon), {
              className: cn("h-3.5 w-3.5", iconFg),
            })}
            {category.name}
          </span>
        </nav>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
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

          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSave}
            disabled={saveStatus === "saving"}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Save
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/resources/article/${article.slug}`}>
              View article
            </Link>
          </Button>
          {/* Primary Publish / Unpublish (WS2). Confirmation before either. */}
          {isPublished ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPublishOpen(true)}
              disabled={isPublishPending}
            >
              <EyeOff className="h-3.5 w-3.5 mr-1.5" />
              Unpublish
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setPublishOpen(true)}
              disabled={isPublishPending}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Publish
            </Button>
          )}
        </div>
      </div>

      <PublishConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={article.title}
        mode={isPublished ? "unpublish" : "publish"}
        onConfirm={handlePublishToggle}
        disabled={isPublishPending}
      />

      {/* Article title */}
      <h1 className="text-[26px] font-bold tracking-tight leading-tight">
        {article.title}
      </h1>

      {/* Plate editor */}
      <PlateRichEditor
        initialValue={initialValue}
        onChange={handleChange}
        articleId={article.id}
      />
    </div>
  );
}
