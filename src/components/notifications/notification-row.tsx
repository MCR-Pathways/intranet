"use client";

import { createElement, useTransition, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal } from "lucide-react";
import {
  SOURCE_KIND_ICON,
  type NotificationSourceKind,
} from "@/lib/notifications";
import {
  quickSetTodayLocation,
  confirmRemoteArrival,
  setWorkingLocation,
} from "@/app/(protected)/sign-in/actions";
import { getUKToday } from "@/lib/sign-in";
import type { WorkLocation, TimeSlot } from "@/types/database.types";
import {
  saveNotification,
  unsaveNotification,
  restoreNotification,
  clearNotification,
} from "@/app/(protected)/notifications/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn, timeAgo } from "@/lib/utils";
import type { InboxRow } from "@/types/notification";
import type { NotificationTab } from "@/app/(protected)/notifications/actions";

interface NotificationRowProps {
  row: InboxRow;
  tab: NotificationTab;
  onAfterAction: () => void;
}

// Tab-aware kebab. Inbox state rows skip the kebab entirely (Path A:
// state rows resolve naturally; nothing to save / clear). Saved and
// Cleared tabs only ever hold event rows by query design.
export function NotificationRow({ row, tab, onAfterAction }: NotificationRowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isStateRow = row.kind === "state";
  const sourceKind = row.source_kind as NotificationSourceKind | null;
  const Icon = sourceKind ? SOURCE_KIND_ICON[sourceKind] : null;
  const isWorkingLocationState = isStateRow && sourceKind === "working_location";

  const tabTimestamp = (() => {
    if (tab === "saved") return row.saved_at ?? row.created_at;
    if (tab === "cleared") return row.cleared_at ?? row.created_at;
    return row.created_at;
  })();

  const handleOpen = () => {
    if (row.link) router.push(row.link);
  };

  const wrap = (action: () => Promise<{ success: boolean; error: string | null }>, successCopy: string) => {
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        toast.success(successCopy);
        onAfterAction();
      } else {
        toast.error(result.error ?? "Action failed");
      }
    });
  };

  return (
    <div className="group/row relative flex items-start gap-2.5 px-4 py-3 hover:bg-accent rounded-sm">
      {Icon && (
        <span
          className={cn(
            "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            sourceKind === "working_location"
              ? "bg-red-50 text-red-500"
              : "bg-muted text-muted-foreground",
          )}
          aria-label={row.reason || undefined}
        >
          {createElement(Icon, { className: "h-4 w-4" })}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={handleOpen}
          className="text-left w-full"
        >
          <p className="font-medium text-sm leading-tight">{row.title}</p>
          {row.message && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {row.message}
            </p>
          )}
        </button>

        {isWorkingLocationState && (
          <WorkingLocationPicker
            type={row.type as "no_location_set" | "office_arrival_unconfirmed"}
            onAfterAction={onAfterAction}
          />
        )}

        <p className="text-xs text-muted-foreground/70 mt-1">
          {timeAgo(tabTimestamp)}
        </p>
      </div>

      {/* Kebab — event rows only. State rows have no DB id to save/clear. */}
      {!isStateRow && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover/row:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 transition-opacity flex-shrink-0"
              aria-label={`Actions for ${row.title}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {tab === "inbox" && (
              <>
                <DropdownMenuItem
                  onSelect={() => wrap(() => saveNotification(row.id), "Saved")}
                  disabled={isPending}
                >
                  Save
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => wrap(() => clearNotification(row.id), "Cleared")}
                  disabled={isPending}
                >
                  Clear
                </DropdownMenuItem>
              </>
            )}
            {tab === "saved" && (
              <>
                <DropdownMenuItem
                  onSelect={() => wrap(() => unsaveNotification(row.id), "Unsaved")}
                  disabled={isPending}
                >
                  Unsave
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => wrap(() => clearNotification(row.id), "Cleared")}
                  disabled={isPending}
                >
                  Clear
                </DropdownMenuItem>
              </>
            )}
            {tab === "cleared" && (
              <DropdownMenuItem
                onSelect={() => wrap(() => restoreNotification(row.id), "Restored")}
                disabled={isPending}
              >
                Restore
              </DropdownMenuItem>
            )}
            {row.link && (
              <DropdownMenuItem onSelect={handleOpen}>Open</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ─── Working-location inline picker ──────────────────────────────────
// Mirrored from notification-bell.tsx. Kept duplicated for now: tightly
// coupled to row layout, no shared state with the bell, and lifting it
// out would touch the shipped bell file unnecessarily during a feature
// PR. If we extract later, both call sites import the same component.

interface WorkingLocationPickerProps {
  type: "no_location_set" | "office_arrival_unconfirmed";
  onAfterAction: () => void;
}

function WorkingLocationPicker({ type, onAfterAction }: WorkingLocationPickerProps) {
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"picker" | "other-input">("picker");
  const [otherText, setOtherText] = useState("");

  const handleSet = (
    location: "home" | "glasgow_office" | "stevenage_office",
    label: string,
  ) => {
    startTransition(async () => {
      const result = await quickSetTodayLocation(location);
      if (result.success) {
        toast.success(`Location set: ${label}`);
        onAfterAction();
      } else {
        toast.error(result.error ?? "Failed to set location");
      }
    });
  };

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await confirmRemoteArrival();
      if (result.success) {
        toast.success("Arrival confirmed");
        onAfterAction();
      } else {
        toast.error(result.error ?? "Failed to confirm");
      }
    });
  };

  const handleOtherSave = () => {
    const text = otherText.trim();
    if (!text) return;
    startTransition(async () => {
      const result = await setWorkingLocation(
        getUKToday(),
        "full_day" as TimeSlot,
        "other" as WorkLocation,
        text,
      );
      if (result.success) {
        toast.success(`Location set: ${text}`);
        setOtherText("");
        setMode("picker");
        onAfterAction();
      } else {
        toast.error(result.error ?? "Failed to set location");
      }
    });
  };

  if (type === "office_arrival_unconfirmed") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PickerButton onClick={handleConfirm} disabled={isPending}>
          I&apos;m here
        </PickerButton>
        <PickerButton onClick={() => handleSet("home", "Home")} disabled={isPending}>
          Home
        </PickerButton>
      </div>
    );
  }

  if (mode === "other-input") {
    return (
      <div className="mt-2 flex items-center gap-1.5">
        <Input
          autoFocus
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleOtherSave();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setMode("picker");
              setOtherText("");
            }
          }}
          placeholder="Where today?"
          aria-label="Other location"
          maxLength={200}
          className="h-8 flex-1 bg-card px-2 text-xs"
        />
        <button
          type="button"
          onClick={handleOtherSave}
          disabled={!otherText.trim() || isPending}
          aria-busy={isPending}
          className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("picker");
            setOtherText("");
          }}
          disabled={isPending}
          aria-busy={isPending}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <PickerButton onClick={() => handleSet("home", "Home")} disabled={isPending}>
        Home
      </PickerButton>
      <PickerButton onClick={() => handleSet("glasgow_office", "Glasgow")} disabled={isPending}>
        Glasgow
      </PickerButton>
      <PickerButton onClick={() => handleSet("stevenage_office", "Stevenage")} disabled={isPending}>
        Stevenage
      </PickerButton>
      <PickerButton onClick={() => setMode("other-input")} disabled={isPending}>
        Other
      </PickerButton>
    </div>
  );
}

function PickerButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={disabled}
      className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all disabled:opacity-50 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}
