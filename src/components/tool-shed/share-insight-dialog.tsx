"use client";

import { useState, useTransition, useEffect, useCallback, createElement } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
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
  const [step, setStep] = useState<1 | 2>(isEditing ? 2 : 1);
  const [format, setFormat] = useState<ToolShedFormat | null>(
    editEntry?.format ?? null
  );
  const [content, setContent] = useState<Partial<FormatContent>>(
    (editEntry?.content as Partial<FormatContent>) ?? {}
  );
  const [eventName, setEventName] = useState(editEntry?.event_name ?? "");
  const [eventDate, setEventDate] = useState(editEntry?.event_date ?? "");
  const [tags, setTags] = useState<string[]>(editEntry?.tags ?? []);
  const [isDraft, setIsDraft] = useState(editEntry ? !editEntry.is_published : false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Event name autocomplete
  const [eventSuggestions, setEventSuggestions] = useState<string[]>([]);
  const [showEventSuggestions, setShowEventSuggestions] = useState(false);

  // Reset form when dialog closes or editEntry changes
  useEffect(() => {
    if (open) {
      if (editEntry) {
        setStep(2);
        setFormat(editEntry.format);
        setContent(editEntry.content as Partial<FormatContent>);
        setEventName(editEntry.event_name ?? "");
        setEventDate(editEntry.event_date ?? "");
        setTags(editEntry.tags ?? []);
        setIsDraft(!editEntry.is_published);
        setError(null);
      } else {
        setStep(1);
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
    setStep(2);
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
        toast.success(isEditing ? "Insight updated" : isDraft ? "Draft saved" : "Insight shared!");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {isEditing
              ? "Edit Insight"
              : step === 1
                ? "Share an Insight"
                : format
                  ? toolShedFormatConfig[format].label
                  : "Share an Insight"}
          </DialogTitle>
          {step === 1 && !isEditing && (
            <DialogDescription>
              Choose a format that suits what you'd like to share. Each one takes just a few minutes.
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Step 1: Format Picker */}
        {step === 1 && !isEditing && (
          <div className="space-y-3 pt-1">
            {formatEntries.map(([key, config]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectFormat(key)}
                className={cn(
                  "w-full flex items-start gap-4 rounded-xl border p-4 text-left transition-colors",
                  "hover:border-primary/50 hover:bg-accent/30",
                  format === key
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border"
                )}
              >
                {/* Format icon */}
                <div className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                  config.accent.iconBg
                )}>
                  {createElement(config.icon, {
                    className: cn("h-5.5 w-5.5", config.accent.text),
                  })}
                </div>

                {/* Format info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold">{config.label}</span>
                    <span className="text-xs text-muted-foreground">
                      · {config.structure}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {config.description}
                  </p>
                </div>

                {/* Arrow */}
                <ArrowRight className="h-4 w-4 text-muted-foreground/50 mt-1 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Content Form */}
        {step === 2 && format && (
          <div className="space-y-6">
            {/* Format badge */}
            <div className="flex items-center gap-2">
              <Badge variant={toolShedFormatConfig[format].badgeVariant} className="gap-1">
                {createElement(toolShedFormatConfig[format].icon, { className: "h-3 w-3" })}
                {toolShedFormatConfig[format].shortLabel}
              </Badge>
              {isEditing && (
                <span className="text-xs text-muted-foreground">
                  Format cannot be changed
                </span>
              )}
            </div>

            {/* Format-specific fields */}
            <FormatFields
              format={format}
              content={content}
              onChange={setContent as (c: FormatContent) => void}
            />

            <Separator />

            {/* Event details */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Event Details (optional)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 relative">
                  <Label htmlFor="event-name">Event Name</Label>
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
                <div className="space-y-1.5">
                  <Label htmlFor="event-date">Event Date</Label>
                  <Input
                    id="event-date"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className="bg-card"
                  />
                </div>
              </div>
            </div>

            {/* Tags */}
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

            {/* Draft toggle */}
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
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between">
              {!isEditing && (
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  disabled={isPending}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isPending}>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
