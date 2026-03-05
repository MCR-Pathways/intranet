"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, X } from "lucide-react";
import { applyPatternsToWeek } from "@/app/(protected)/sign-in/actions";
import { toast } from "sonner";

interface WeekPlanningBannerProps {
  nextWeekStart: string;
  hasPatterns: boolean;
  onPatternsApplied?: () => void;
  onNavigateToNextWeek?: () => void;
}

export function WeekPlanningBanner({
  nextWeekStart,
  hasPatterns,
  onPatternsApplied,
  onNavigateToNextWeek,
}: WeekPlanningBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      const key = `week-plan-banner-${nextWeekStart}`;
      return localStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  });
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  const dismiss = () => {
    try {
      const key = `week-plan-banner-${nextWeekStart}`;
      localStorage.setItem(key, "true");
    } catch {
      // localStorage unavailable
    }
    setDismissed(true);
  };

  const handleApplyDefaults = () => {
    startTransition(async () => {
      const result = await applyPatternsToWeek(nextWeekStart);
      if (result.success) {
        toast.success(
          result.applied > 0
            ? `Applied defaults to ${result.applied} day${result.applied > 1 ? "s" : ""}`
            : "No gaps to fill — your week is already planned"
        );
        onPatternsApplied?.();
        setDismissed(true);
      } else {
        toast.error(result.error ?? "Failed to apply defaults");
      }
    });
  };

  return (
    <div className="relative flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <Calendar className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800">
          Your week isn&apos;t planned yet
        </p>
        <p className="text-sm text-amber-700 mt-0.5">
          Set your working locations for next week so your team knows where to find you.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {hasPatterns && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleApplyDefaults}
              disabled={isPending}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              Apply My Defaults
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              onNavigateToNextWeek?.();
              setDismissed(true);
            }}
            disabled={isPending}
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            Plan Manually
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="text-amber-400 hover:text-amber-600 flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
