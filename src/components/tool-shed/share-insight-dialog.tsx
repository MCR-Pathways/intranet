"use client";

import { useState, useTransition, useEffect, useCallback, createElement } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  toolShedFormatConfig,
  type ToolShedFormat,
  type PostcardContent,
  type ThreeTwoOneContent,
  type TakeoverContent,
} from "@/lib/learning";
import { cn } from "@/lib/utils";
import { FormatFields } from "./format-fields";
import { TagInput } from "./tag-input";
import {
  createEntry,
  updateEntry,
  getEventSuggestions,
} from "@/app/(protected)/learning/tool-shed/actions";
import type { ToolShedEntryWithAuthor } from "@/app/(protected)/learning/tool-shed/actions";

// ─── Types ──────────────────────────────────────────────────────────────────

type FormatContent = PostcardContent | ThreeTwoOneContent | TakeoverContent;

interface ShareInsightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editEntry?: ToolShedEntryWithAuthor | null;
  popularTags?: string[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ShareInsightDialog({
  open,
  onOpenChange,
  editEntry = null,
  popularTags = [],
}: ShareInsightDialogProps) {
  const isEditing = !!editEntry;
  const [format, setFormat] = useState<ToolShedFormat | null>(
    editEntry?.format ?? null
  );
  const [content, setContent] = useState<Partial<FormatContent>>(
    (editEntry?.content as Partial<FormatContent>) ?? {}
  );
  const [eventName, setEventName] = useState(editEntry?.event_name ?? "");
  const [eventDate, setEventDate] = useState(editEntry?.event_date ?? "");
  const [tags, setTags] = useState<string[]>(editEntry?.tags ?? []);
  const [isDraft, setIsDraft] = useState(
    editEntry ? !editEntry.is_published : false
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);

  // Detect if user has entered any content (for unsaved changes warning)
  const hasContent = !isEditing && (
    !!format || !!eventName.trim() || tags.length > 0 ||
    Object.values(content).some((v) =>
      typeof v === "string" ? v.trim().length > 0 :
      Array.isArray(v) ? v.some((item) => typeof item === "string" && item.trim().length > 0) :
      false
    )
  );

  const handleClose = useCallback(() => {
    if (hasContent && !isPending) {
      setShowDiscardAlert(true);
    } else {
      onOpenChange(false);
    }
  }, [hasContent, isPending, onOpenChange]);

  const preventCloseIfDirty = useCallback((e: { preventDefault: () => void }) => {
    if (hasContent) {
      e.preventDefault();
      setShowDiscardAlert(true);
    }
  }, [hasContent]);

  // Event name autocomplete
  const [eventSuggestions, setEventSuggestions] = useState<string[]>([]);
  const [showEventSuggestions, setShowEventSuggestions] = useState(false);

  // Reset form when dialog opens/closes or editEntry changes
  useEffect(() => {
    if (open) {
      if (editEntry) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormat(editEntry.format);
        setContent(editEntry.content as Partial<FormatContent>);
        setEventName(editEntry.event_name ?? "");
        setEventDate(editEntry.event_date ?? "");
        setTags(editEntry.tags ?? []);
        setIsDraft(!editEntry.is_published);
        setError(null);
      } else {
        setFormat(null);
        setContent({});
        setEventName("");
        setEventDate("");
        setTags([]);
        setIsDraft(false);
        setError(null);
      }
    }
  }, [open, editEntry]);

  // Debounced event name suggestions
  useEffect(() => {
    if (!eventName.trim() || eventName.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEventSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      const result = await getEventSuggestions(eventName);
      if (result.suggestions.length > 0) {
        setEventSuggestions(result.suggestions);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [eventName]);

  const handleSelectFormat = (key: ToolShedFormat) => {
    if (isEditing) return;
    setFormat(key);
    // Initialise empty content for the selected format
    if (key === "postcard") {
      setContent({
        elevator_pitch: "",
        lightbulb_moment: "",
        programme_impact: "",
        golden_nugget: "",
      });
    } else if (key === "three_two_one") {
      setContent({
        three_learned: ["", "", ""],
        two_changes: ["", ""],
        one_question: "",
      });
    } else if (key === "takeover") {
      setContent({ useful_things: ["", "", ""] });
    }
  };

  const handleSubmit = useCallback(() => {
    if (!format) {
      setError("Please select a format");
      return;
    }

    setError(null);
    startTransition(async () => {
      const payload = {
        format,
        content: content as Record<string, unknown>,
        event_name: eventName.trim() || null,
        event_date: eventDate || null,
        tags,
        is_published: !isDraft,
      };

      const result = isEditing
        ? await updateEntry(editEntry!.id, payload).catch(() => ({
            success: false,
            error: "Failed to update insight",
          }))
        : await createEntry(payload).catch(() => ({
            success: false,
            error: "Failed to share insight",
          }));

      if (result.success) {
        toast.success(
          isEditing ? "Insight updated" : isDraft ? "Draft saved" : "Insight shared!"
        );
        onOpenChange(false);
      } else {
        setError(result.error ?? "Something went wrong");
        toast.error(result.error ?? "Something went wrong");
      }
    });
  }, [format, content, eventName, eventDate, tags, isDraft, isEditing, editEntry, onOpenChange]);

  const formatEntries = Object.entries(toolShedFormatConfig) as [
    ToolShedFormat,
    (typeof toolShedFormatConfig)[ToolShedFormat],
  ][];

  const selectedConfig = format ? toolShedFormatConfig[format] : null;

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="bg-card sm:max-w-xl max-h-[85vh] overflow-y-auto"
        onInteractOutside={preventCloseIfDirty}
        onEscapeKeyDown={preventCloseIfDirty}
      >
        <DialogHeader>
          <DialogTitle className="text-lg">
            {isEditing ? "Edit Insight" : "Share an Insight"}
          </DialogTitle>
          {!isEditing && (
            <DialogDescription>
              Share your reflections from a training event so the whole team
              benefits.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Event context ── */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              What did you attend?
            </h3>
            <div className="grid grid-cols-[1fr_140px] gap-3">
              <div className="relative">
                <Input
                  id="event-name"
                  placeholder="e.g. Trauma-Informed Practice Workshop"
                  value={eventName}
                  onChange={(e) => {
                    setEventName(e.target.value);
                    setShowEventSuggestions(true);
                  }}
                  onFocus={() => setShowEventSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowEventSuggestions(false), 200)
                  }
                  maxLength={200}
                  className="bg-card"
                  aria-label="Event name"
                />
                {showEventSuggestions && eventSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover p-1 shadow-md">
                    {eventSuggestions
                      .filter(
                        (s) =>
                          s.toLowerCase() !== eventName.trim().toLowerCase()
                      )
                      .slice(0, 5)
                      .map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setEventName(suggestion);
                            setShowEventSuggestions(false);
                          }}
                        >
                          {suggestion}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <Input
                id="event-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="bg-card"
                aria-label="Event date"
              />
            </div>
          </div>

          <Separator />

          {/* ── Format picker ── */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              {isEditing ? "Format" : "Pick a format"}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {formatEntries.map(([key, config]) => {
                const isSelected = format === key;
                const isDisabled = isEditing && !isSelected;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectFormat(key)}
                    disabled={isDisabled}
                    title={config.description}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all",
                      isSelected
                        ? cn(
                            "ring-2 ring-offset-1",
                            config.accent.ring,
                            config.accent.bg
                          )
                        : "border-border hover:border-primary/30 hover:bg-accent/20",
                      isDisabled &&
                        "opacity-35 cursor-not-allowed hover:border-border hover:bg-transparent"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                        isSelected ? config.accent.iconBg : "bg-muted"
                      )}
                    >
                      {createElement(config.icon, {
                        className: cn(
                          "h-4 w-4",
                          isSelected
                            ? config.accent.text
                            : "text-muted-foreground"
                        ),
                      })}
                    </div>
                    <div className="text-center">
                      <span
                        className={cn(
                          "text-xs font-semibold block",
                          isSelected && config.accent.text
                        )}
                      >
                        {config.shortLabel}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {config.structure}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Format-specific fields ── */}
          {format && selectedConfig && (
            <>
              <Separator />
              <div
                className={cn(
                  "border-l-4 pl-4",
                  selectedConfig.accent.border
                )}
              >
                <FormatFields
                  format={format}
                  content={content}
                  onChange={setContent as (c: FormatContent) => void}
                />
              </div>
            </>
          )}

          {/* ── Tags ── */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <TagInput
              tags={tags}
              onChange={setTags}
              suggestions={popularTags}
              maxTags={5}
              placeholder="Add tags to help others find your insight..."
            />
          </div>

          {/* ── Draft toggle ── */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="draft-toggle" className="cursor-pointer">
                Save as draft
              </Label>
              <p className="text-xs text-muted-foreground">
                Only you can see drafts. Share when you&apos;re ready.
              </p>
            </div>
            <Switch
              id="draft-toggle"
              checked={isDraft}
              onCheckedChange={setIsDraft}
            />
          </div>

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* ── Footer ── */}
          <div className="flex items-center gap-2">
            {!isEditing && !isDraft && (
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors mr-auto"
                onClick={() => setIsDraft(true)}
              >
                or save as draft
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isPending || !format}>
                {isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {isEditing
                  ? "Save Changes"
                  : isDraft
                    ? "Save Draft"
                    : "Share"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Discard changes confirmation */}
    <AlertDialog open={showDiscardAlert} onOpenChange={setShowDiscardAlert}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved content. Are you sure you want to discard it?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowDiscardAlert(false)}
          >
            Keep Editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setShowDiscardAlert(false);
              onOpenChange(false);
            }}
          >
            Discard
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
