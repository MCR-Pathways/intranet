"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, X, Check, Loader2 } from "lucide-react";
import { recordSignIn } from "@/app/(protected)/sign-in/actions";
import { LOCATIONS } from "@/lib/sign-in";
import type { WorkLocation } from "@/types/database.types";

export function SignInNudgeBubble() {
  const pathname = usePathname();
  const router = useRouter();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherLocation, setOtherLocation] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        router.refresh();
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
    <div className="absolute top-full right-0 mt-2 z-50">
      {/* Speech bubble arrow — shadow creates the border effect, bg-card covers card border */}
      <div className="absolute -top-[6px] right-[13px] z-10 w-4 h-4 rotate-45 bg-card shadow-[-1px_-1px_0_0_var(--color-border)]" />

      {/* Bubble content */}
      <div className="relative w-80 rounded-2xl bg-card border border-border shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Where are you working?</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Location buttons or Other input */}
        <div className="px-4 pb-4 pt-1">
          {!showOtherInput ? (
            <div className="grid grid-cols-2 gap-2">
              {LOCATIONS.map((loc) => (
                <Button
                  key={loc.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleLocationClick(loc.id)}
                  disabled={isPending}
                  className="h-9 gap-1.5"
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
                className="h-9"
                maxLength={200}
                disabled={isPending}
                autoFocus
              />
              <Button
                size="sm"
                onClick={handleOtherSubmit}
                disabled={isPending || !otherLocation.trim()}
                className="h-9 shrink-0"
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
                className="h-9 shrink-0 text-xs"
              >
                Back
              </Button>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive mt-2">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
