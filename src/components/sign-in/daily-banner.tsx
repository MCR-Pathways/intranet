"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Building2, Home, MapPin, X, CheckCircle2 } from "lucide-react";
import {
  confirmRemoteArrival,
  quickSetTodayLocation,
} from "@/app/(protected)/sign-in/actions";
import { toast } from "sonner";

interface DailyBannerProps {
  type: "office_not_confirmed" | "no_schedule";
}

export function DailyBanner({ type }: DailyBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      const key = `daily-banner-${type}-${new Date().toISOString().split("T")[0]}`;
      return localStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  });
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  const dismiss = () => {
    try {
      const key = `daily-banner-${type}-${new Date().toISOString().split("T")[0]}`;
      localStorage.setItem(key, "true");
    } catch {
      // localStorage unavailable
    }
    setDismissed(true);
  };

  const handleConfirmArrival = () => {
    startTransition(async () => {
      const result = await confirmRemoteArrival();
      if (result.success) {
        toast.success("Arrival confirmed");
        setDismissed(true);
      } else {
        toast.error(result.error ?? "Failed to confirm");
      }
    });
  };

  const handleQuickLocation = (location: "home" | "glasgow_office" | "stevenage_office") => {
    startTransition(async () => {
      const result = await quickSetTodayLocation(location);
      if (result.success) {
        const labels = {
          home: "Home",
          glasgow_office: "Glasgow Office",
          stevenage_office: "Stevenage Office",
        };
        toast.success(`Location set: ${labels[location]}`);
        setDismissed(true);
      } else {
        toast.error(result.error ?? "Failed to set location");
      }
    });
  };

  if (type === "office_not_confirmed") {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <Building2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-800">
            You&apos;re scheduled for the office today.
          </p>
          <p className="text-sm text-blue-700 mt-0.5">
            Are you here, or have your plans changed?
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleConfirmArrival}
              disabled={isPending}
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              I&apos;m Here
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => handleQuickLocation("home")}
              disabled={isPending}
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <Home className="h-3.5 w-3.5 mr-1" />
              Working From Home
            </Button>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => {
                window.location.href = "/sign-in";
              }}
              disabled={isPending}
              className="text-blue-700"
            >
              Update Location
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-blue-400 hover:text-blue-600 flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // type === "no_schedule"
  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <MapPin className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800">
          Where are you working today?
        </p>
        <p className="text-sm text-amber-700 mt-0.5">
          Let your team know your location.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => handleQuickLocation("home")}
            disabled={isPending}
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            <Home className="h-3.5 w-3.5 mr-1" />
            Home
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => handleQuickLocation("glasgow_office")}
            disabled={isPending}
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            <Building2 className="h-3.5 w-3.5 mr-1" />
            Glasgow
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => handleQuickLocation("stevenage_office")}
            disabled={isPending}
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            <Building2 className="h-3.5 w-3.5 mr-1" />
            Stevenage
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => {
              window.location.href = "/sign-in";
            }}
            disabled={isPending}
            className="text-amber-700"
          >
            <MapPin className="h-3.5 w-3.5 mr-1" />
            Other
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
