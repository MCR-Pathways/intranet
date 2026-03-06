"use client";

import { cn } from "@/lib/utils";

interface OnboardingProgressBarProps {
  completed: number;
  total: number;
  className?: string;
  /** Show the text label (default: true) */
  showLabel?: boolean;
}

export function OnboardingProgressBar({
  completed,
  total,
  className,
  showLabel = true,
}: OnboardingProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {completed}/{total}
        </span>
      )}
    </div>
  );
}
