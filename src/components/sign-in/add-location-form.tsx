"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Home, Building2, Globe, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { recordSignIn } from "@/app/(protected)/sign-in/actions";
import type { WorkLocation } from "@/types/database.types";

const locations: { id: WorkLocation; name: string; icon: typeof Home; description: string }[] = [
  { id: "home", name: "Home", icon: Home, description: "Working from home" },
  { id: "glasgow_office", name: "Glasgow Office", icon: Building2, description: "Glasgow HQ" },
  { id: "stevenage_office", name: "Stevenage Office", icon: Building2, description: "Stevenage office" },
  { id: "other", name: "Other", icon: Globe, description: "Another location" },
];

export function AddLocationForm() {
  const [selectedLocation, setSelectedLocation] = useState<WorkLocation | null>(null);
  const [otherLocation, setOtherLocation] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleLocationSelect(location: WorkLocation) {
    setSelectedLocation(location);
    setError(null);
    setSuccessMessage(null);

    // Auto-submit for non-other locations
    if (location !== "other") {
      submitSignIn(location);
    }
  }

  function submitSignIn(location: WorkLocation, other?: string) {
    startTransition(async () => {
      setError(null);
      setSuccessMessage(null);
      const result = await recordSignIn(location, other);
      if (result.success) {
        const loc = locations.find((l) => l.id === location);
        setSuccessMessage(
          location === "other"
            ? `Recorded: ${other}`
            : `Recorded: ${loc?.name ?? location}`
        );
        setSelectedLocation(null);
        setOtherLocation("");
      } else {
        setError(result.error ?? "Failed to record location");
      }
    });
  }

  function handleOtherSubmit() {
    if (!otherLocation.trim()) return;
    submitSignIn("other", otherLocation);
  }

  function handleOtherKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleOtherSubmit();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Add Location
        </CardTitle>
        <CardDescription>
          Record where you&apos;re working right now
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {locations.map((loc) => (
            <Button
              key={loc.id}
              variant="outline"
              className={cn(
                "h-auto py-3 px-4 flex flex-col items-center gap-2 border-2 transition-colors",
                selectedLocation === loc.id &&
                  "border-primary bg-primary/5"
              )}
              onClick={() => handleLocationSelect(loc.id)}
              disabled={isPending}
            >
              {isPending && selectedLocation === loc.id ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <loc.icon className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">{loc.name}</span>
            </Button>
          ))}
        </div>

        {selectedLocation === "other" && (
          <div className="flex gap-2">
            <Input
              placeholder="Enter your location"
              value={otherLocation}
              onChange={(e) => setOtherLocation(e.target.value)}
              onKeyDown={handleOtherKeyDown}
              maxLength={200}
              disabled={isPending}
              autoFocus
            />
            <Button
              onClick={handleOtherSubmit}
              disabled={isPending || !otherLocation.trim()}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {successMessage && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {successMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
