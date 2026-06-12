"use client";

import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, X, BarChart3, Check } from "lucide-react";

export interface PollData {
  question: string;
  options: string[];
  duration: string; // "1d" | "3d" | "1w" | "2w" | "1m" | "none" | "custom"
  customCloseDate?: string;
  allowMultiple: boolean;
}

const DURATION_OPTIONS = [
  { value: "1d", label: "1 day" },
  { value: "3d", label: "3 days" },
  { value: "1w", label: "1 week" },
  { value: "2w", label: "2 weeks" },
  { value: "1m", label: "1 month" },
  { value: "none", label: "No expiry" },
  { value: "custom", label: "Custom" },
] as const;

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
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
    (duration: string) => {
      // Clear custom date when switching away from custom
      if (duration !== "custom") {
        onChange({ ...poll, duration, customCloseDate: undefined });
      } else {
        onChange({ ...poll, duration });
      }
    },
    [poll, onChange]
  );

  /** Minimum date for the custom date picker (today). */
  const minDate = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }, []);

  /** Split customCloseDate (ISO or "YYYY-MM-DDTHH:MM") into separate date and time values. */
  const customDate = poll.customCloseDate?.split("T")[0] ?? "";
  const customTime = poll.customCloseDate?.split("T")[1]?.slice(0, 5) ?? "";

  const handleCustomDateChange = useCallback(
    (date: string, time: string) => {
      if (!date) {
        onChange({ ...poll, customCloseDate: undefined });
        return;
      }
      const combined = `${date}T${time || "17:00"}`;
      onChange({ ...poll, customCloseDate: combined });
    },
    [poll, onChange]
  );

  return (
    <div className="overflow-hidden rounded-[12px] border border-mcr-light-blue-border">
      {/* Header strip — the sky-blue accent marking this as a poll panel. */}
      <div className="flex items-center gap-2 bg-mcr-light-blue-50 px-4 py-2.5">
        <BarChart3 className="h-4 w-4 text-icon-fg-light-blue" />
        <span className="text-[13.5px] font-semibold text-icon-fg-light-blue">Poll</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="ml-auto text-icon-fg-light-blue hover:bg-mcr-light-blue-100 hover:text-icon-fg-light-blue"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove poll"
          title="Remove poll"
        >
          <X />
        </Button>
      </div>

      <div className="space-y-3 p-4">
        {/* Question */}
        <Input
          placeholder="Ask a question..."
          value={poll.question}
          onChange={(e) => updateQuestion(e.target.value)}
          maxLength={200}
          disabled={disabled}
          className="bg-card font-medium"
        />

        {/* Options — numbered, each removable */}
        <div className="space-y-2">
          {poll.options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-center text-xs font-bold text-muted-foreground">
                {index + 1}
              </span>
              <Input
                placeholder={`Option ${index + 1}`}
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                maxLength={MAX_OPTION_LENGTH}
                disabled={disabled}
                className="bg-card"
              />
              {poll.options.length > MIN_OPTIONS && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => removeOption(index)}
                  disabled={disabled}
                  aria-label={`Remove option ${index + 1}`}
                  title="Remove option"
                >
                  <X />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Add option — sky-blue text button */}
        {poll.options.length < MAX_OPTIONS && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-icon-fg-light-blue hover:bg-mcr-light-blue-50 hover:text-icon-fg-light-blue"
            onClick={addOption}
            disabled={disabled}
          >
            <Plus />
            Add option
          </Button>
        )}

        {/* Duration selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Poll duration:</span>
          <Select value={poll.duration} onValueChange={updateDuration} disabled={disabled}>
            <SelectTrigger className="h-8 w-36 bg-card">
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

        {/* Custom date + time picker (shown when "Custom" duration selected) */}
        {poll.duration === "custom" && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Closes:</span>
            <Input
              type="date"
              value={customDate}
              onChange={(e) => handleCustomDateChange(e.target.value, customTime)}
              min={minDate}
              disabled={disabled}
              className="h-8 w-auto bg-card"
            />
            <span className="text-sm text-muted-foreground">at</span>
            <Input
              type="time"
              value={customTime}
              onChange={(e) => handleCustomDateChange(customDate, e.target.value)}
              disabled={disabled}
              className="h-8 w-auto bg-card"
            />
          </div>
        )}

        {/* Multi-select toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="poll-multi-select"
            checked={poll.allowMultiple}
            onCheckedChange={(checked: boolean) => onChange({ ...poll, allowMultiple: checked })}
            disabled={disabled}
          />
          <label htmlFor="poll-multi-select" className="cursor-pointer text-sm text-muted-foreground">
            Allow multiple selections
          </label>
        </div>

        {/* Sets the results-hidden expectation up front. */}
        <div className="flex items-center gap-2 rounded-lg border border-mcr-light-blue-border bg-mcr-light-blue-50 px-3 py-2 text-[12.5px] text-icon-fg-light-blue">
          <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
          Results stay hidden until a person votes
        </div>
      </div>
    </div>
  );
}

/**
 * Compute the closes_at ISO string from a duration code.
 * Returns null for "none" (no expiry).
 */
export function computePollClosesAt(duration: string, customCloseDate?: string): string | null {
  const now = new Date();
  const DAY = 24 * 60 * 60 * 1000;
  switch (duration) {
    case "1d":
      return new Date(now.getTime() + DAY).toISOString();
    case "3d":
      return new Date(now.getTime() + 3 * DAY).toISOString();
    case "1w":
      return new Date(now.getTime() + 7 * DAY).toISOString();
    case "2w":
      return new Date(now.getTime() + 14 * DAY).toISOString();
    case "1m": {
      const oneMonthLater = new Date(now);
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
      return oneMonthLater.toISOString();
    }
    case "custom":
      if (!customCloseDate) return null;
      return new Date(customCloseDate).toISOString();
    default:
      return null;
  }
}
