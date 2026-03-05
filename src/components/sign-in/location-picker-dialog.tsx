"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { LOCATIONS, LOCATION_CONFIG, formatScheduleDate } from "@/lib/sign-in";
import type { DaySchedule } from "@/lib/sign-in";
import type { WorkLocation, TimeSlot } from "@/types/database.types";
import { setWorkingLocation, clearWorkingLocation } from "@/app/(protected)/sign-in/actions";
import { toast } from "sonner";

interface LocationPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  timeSlot: TimeSlot;
  schedule: DaySchedule;
  onOptimisticUpdate: (
    date: string,
    timeSlot: TimeSlot,
    location: WorkLocation | null,
    otherLocation?: string
  ) => void;
}

export function LocationPickerDialog({
  open,
  onOpenChange,
  date,
  timeSlot,
  schedule,
  onOptimisticUpdate,
}: LocationPickerDialogProps) {
  const existingEntry =
    timeSlot === "full_day"
      ? schedule.fullDay
      : timeSlot === "morning"
        ? schedule.morning
        : schedule.afternoon;

  const [selectedLocation, setSelectedLocation] = useState<WorkLocation | null>(
    existingEntry?.location ?? null
  );
  const [otherText, setOtherText] = useState(existingEntry?.other_location ?? "");
  const [splitDay, setSplitDay] = useState(timeSlot !== "full_day");
  const [isPending, startTransition] = useTransition();

  // Reset state when dialog opens with new data
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSelectedLocation(existingEntry?.location ?? null);
      setOtherText(existingEntry?.other_location ?? "");
      setSplitDay(timeSlot !== "full_day");
    }
    onOpenChange(newOpen);
  };

  const handleSave = () => {
    if (!selectedLocation) return;
    if (selectedLocation === "other" && !otherText.trim()) {
      toast.error("Please specify your location");
      return;
    }

    const effectiveTimeSlot = splitDay ? timeSlot : "full_day";
    const otherLocation = selectedLocation === "other" ? otherText.trim() : undefined;

    // Optimistic update
    onOptimisticUpdate(date, effectiveTimeSlot, selectedLocation, otherLocation);
    onOpenChange(false);

    // Server sync
    startTransition(async () => {
      const result = await setWorkingLocation(date, effectiveTimeSlot, selectedLocation, otherLocation);
      if (!result.success) {
        toast.error(result.error ?? "Failed to set location");
        // Revert optimistic update by clearing
        onOptimisticUpdate(date, effectiveTimeSlot, null);
      } else {
        const dayName = formatScheduleDate(date).split(" ")[0]?.replace(",", "");
        toast.success(`Location set for ${dayName}`);
      }
    });
  };

  const handleClear = () => {
    onOptimisticUpdate(date, timeSlot === "full_day" ? "full_day" : timeSlot, null);
    onOpenChange(false);

    startTransition(async () => {
      const effectiveTimeSlot = splitDay ? timeSlot : "full_day";
      const result = await clearWorkingLocation(date, effectiveTimeSlot);
      if (!result.success) {
        toast.error(result.error ?? "Failed to clear location");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set location for {formatScheduleDate(date)}</DialogTitle>
          <DialogDescription className="sr-only">
            Choose your working location for this day
          </DialogDescription>
        </DialogHeader>

        {/* Location grid */}
        <div className="grid grid-cols-2 gap-3">
          {LOCATIONS.map((loc) => {
            const config = LOCATION_CONFIG[loc.id];
            const isSelected = selectedLocation === loc.id;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => setSelectedLocation(loc.id)}
                className={cn(
                  "rounded-lg p-4 flex flex-col items-center gap-2 transition-all duration-150",
                  isSelected
                    ? `${config.bgClass} ${config.textClass} ring-2 ring-primary shadow-sm`
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                )}
              >
                <loc.icon className="h-6 w-6" />
                <span className="text-sm font-medium">{loc.name}</span>
              </button>
            );
          })}
        </div>

        {/* Split-day toggle */}
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label htmlFor="split-day" className="text-sm">
            Split day (different AM/PM)
          </Label>
          <Switch
            id="split-day"
            checked={splitDay}
            onCheckedChange={setSplitDay}
          />
        </div>

        {/* Other location input */}
        {selectedLocation === "other" && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            <Input
              placeholder="Where are you working?"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </div>
        )}

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            disabled={!existingEntry || isPending}
          >
            Clear
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!selectedLocation || isPending}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
