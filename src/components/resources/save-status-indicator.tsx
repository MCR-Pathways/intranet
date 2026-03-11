"use client";

import { useEffect, useState } from "react";
import { Circle, Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "@/hooks/use-auto-save";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
}

export function SaveStatusIndicator({ status }: SaveStatusIndicatorProps) {
  const [visible, setVisible] = useState(false);

  // "All changes saved" fades out after 3 seconds
  useEffect(() => {
    if (status === "saved") {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }

    // Show indicator for all non-idle states
    setVisible(status !== "idle");
  }, [status]);

  if (status === "idle" || (!visible && status === "saved")) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs transition-opacity duration-300",
        status === "error" ? "text-destructive" : "text-muted-foreground",
        status === "saved" && !visible && "opacity-0"
      )}
      role="status"
      aria-live="polite"
    >
      {status === "unsaved" && (
        <>
          <Circle className="h-3 w-3 fill-current" />
          <span>Unsaved changes</span>
        </>
      )}
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving…</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-3 w-3" />
          <span>All changes saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-3 w-3" />
          <span>Could not save</span>
        </>
      )}
    </div>
  );
}
