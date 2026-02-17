"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Home, Building2, Globe, X, Check, Loader2 } from "lucide-react";
import { recordSignIn } from "@/app/(protected)/sign-in/actions";
import type { WorkLocation } from "@/types/database.types";

const locations: { id: WorkLocation; name: string; icon: typeof Home }[] = [
  { id: "home", name: "Home", icon: Home },
  { id: "glasgow_office", name: "Glasgow", icon: Building2 },
  { id: "stevenage_office", name: "Stevenage", icon: Building2 },
  { id: "other", name: "Other", icon: Globe },
];

export function SignInBanner() {
  const pathname = usePathname();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherLocation, setOtherLocation] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hide banner when user is already on the sign-in page
  if (isDismissed || isSuccess || pathname === "/sign-in") return null;

  function handleLocationClick(location: WorkLocation) {
    if (location === "other") {
      setShowOtherInput(true);
      return;
    }
    submitSignIn(location);
  }

  function submitSignIn(location: WorkLocation, other?: string) {
    startTransition(async () => {
      setError(null);
      const result = await recordSignIn(location, other);
      if (result.success) {
        setIsSuccess(true);
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
    <div className="sticky top-16 z-40 border-b border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
      <div className="container max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            <MapPin className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Where are you working today?
            </span>

            {!showOtherInput ? (
              <div className="flex gap-2 flex-wrap">
                {locations.map((loc) => (
                  <Button
                    key={loc.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleLocationClick(loc.id)}
                    disabled={isPending}
                    className="h-8 gap-1.5 bg-white dark:bg-transparent"
                  >
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <loc.icon className="h-3.5 w-3.5" />
                    )}
                    {loc.name}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Enter your location"
                  value={otherLocation}
                  onChange={(e) => setOtherLocation(e.target.value)}
                  onKeyDown={handleOtherKeyDown}
                  className="h-8 w-48 bg-white dark:bg-transparent"
                  maxLength={200}
                  disabled={isPending}
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleOtherSubmit}
                  disabled={isPending || !otherLocation.trim()}
                  className="h-8"
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowOtherInput(false);
                    setOtherLocation("");
                  }}
                  disabled={isPending}
                  className="h-8"
                >
                  Back
                </Button>
              </div>
            )}

            {error && (
              <span className="text-xs text-destructive">{error}</span>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
