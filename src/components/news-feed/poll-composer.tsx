"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Trash2 } from "lucide-react";

export interface PollData {
  question: string;
  options: string[];
  duration: string; // "1d" | "3d" | "1w" | "none"
}

const DURATION_OPTIONS = [
  { value: "1d", label: "1 day" },
  { value: "3d", label: "3 days" },
  { value: "1w", label: "1 week" },
  { value: "none", label: "No expiry" },
] as const;

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;
const MAX_OPTION_LENGTH = 100;

interface PollComposerProps {
  poll: PollData;
  onChange: (poll: PollData) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function PollComposer({ poll, onChange, onRemove, disabled }: PollComposerProps) {
  const updateQuestion = useCallback(
    (question: string) => onChange({ ...poll, question }),
    [poll, onChange]
  );

  const updateOption = useCallback(
    (index: number, value: string) => {
      const options = [...poll.options];
      options[index] = value;
      onChange({ ...poll, options });
    },
    [poll, onChange]
  );

  const addOption = useCallback(() => {
    if (poll.options.length >= MAX_OPTIONS) return;
    onChange({ ...poll, options: [...poll.options, ""] });
  }, [poll, onChange]);

  const removeOption = useCallback(
    (index: number) => {
      if (poll.options.length <= MIN_OPTIONS) return;
      const options = poll.options.filter((_, i) => i !== index);
      onChange({ ...poll, options });
    },
    [poll, onChange]
  );

  const updateDuration = useCallback(
    (duration: string) => onChange({ ...poll, duration }),
    [poll, onChange]
  );

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Poll</h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Remove poll</span>
        </Button>
      </div>

      {/* Question */}
      <Input
        placeholder="Ask a question..."
        value={poll.question}
        onChange={(e) => updateQuestion(e.target.value)}
        maxLength={200}
        disabled={disabled}
        className="bg-background"
      />

      {/* Options */}
      <div className="space-y-2">
        {poll.options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              placeholder={`Option ${index + 1}`}
              value={option}
              onChange={(e) => updateOption(index, e.target.value)}
              maxLength={MAX_OPTION_LENGTH}
              disabled={disabled}
              className="bg-background"
            />
            {poll.options.length > MIN_OPTIONS && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeOption(index)}
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Remove option</span>
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Add option button */}
      {poll.options.length < MAX_OPTIONS && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={addOption}
          disabled={disabled}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add option
        </Button>
      )}

      {/* Duration selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Poll duration:</span>
        <Select value={poll.duration} onValueChange={updateDuration} disabled={disabled}>
          <SelectTrigger className="w-32 h-8 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURATION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/**
 * Compute the closes_at ISO string from a duration code.
 * Returns null for "none" (no expiry).
 */
export function computePollClosesAt(duration: string): string | null {
  const now = new Date();
  switch (duration) {
    case "1d":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case "3d":
      return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    case "1w":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return null;
  }
}
