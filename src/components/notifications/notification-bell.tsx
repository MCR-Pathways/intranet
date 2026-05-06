"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import {
  getInboxStream,
  clearNotification,
  clearAllNotifications,
} from "@/app/(protected)/notifications/actions";
import {
  quickSetTodayLocation,
  confirmRemoteArrival,
} from "@/app/(protected)/sign-in/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, ChevronRight, Inbox, X } from "lucide-react";
import { createElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { timeAgo } from "@/lib/utils";
import { logger } from "@/lib/logger";
import {
  EMPTY_INBOX_COPY,
  INFORMATIONAL_SOURCE_KINDS,
  SOURCE_KIND_ACTION_VERB,
  SOURCE_KIND_ICON,
  type NotificationSourceKind,
} from "@/lib/notifications";
import type { InboxRow } from "@/types/notification";

interface NotificationBellProps {
  initialRows?: InboxRow[];
}

export function NotificationBell({ initialRows }: NotificationBellProps) {
  const router = useRouter();
  const hasInitialData = initialRows !== undefined;
  const [rows, setRows] = useState<InboxRow[]>(initialRows ?? []);
  const [isLoading, setIsLoading] = useState(!hasInitialData);

  // Empty-state line is re-rolled every time the popover opens. Initial
  // value is the first variant — it's never visible because the popover
  // is closed at mount, and onOpenChange fires before the first render
  // of the popover content.
  const [emptyLine, setEmptyLine] = useState<string>(EMPTY_INBOX_COPY[0]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      setEmptyLine(
        EMPTY_INBOX_COPY[Math.floor(Math.random() * EMPTY_INBOX_COPY.length)],
      );
    }
  }, []);

  const fetchRows = useCallback(async () => {
    const { rows: data, error } = await getInboxStream();
    if (error) {
      logger.error("Error fetching inbox stream", { error });
      setIsLoading(false);
      return;
    }
    setRows(data);
    setIsLoading(false);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- syncing server props to client state */
  useEffect(() => {
    if (initialRows === undefined) return;
    setRows(initialRows);
    setIsLoading(false);
  }, [initialRows]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect -- legitimate data-fetching-on-mount when no SSR data */
  useEffect(() => {
    if (hasInitialData) return;
    fetchRows();
  }, [fetchRows, hasInitialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleClearAll = async () => {
    if (rows.length === 0) return;
    const previous = rows;
    setRows([]); // optimistic
    const { error } = await clearAllNotifications();
    if (error) {
      logger.error("Failed to clear all notifications", { error });
      setRows(previous);
    }
  };

  const handleClear = useCallback(
    async (rowId: string) => {
      // Synthetic state-row ids start with `state:` and aren't valid DB
      // notification ids — clearing them server-side is a no-op the API
      // would reject. State rows resolve naturally when underlying state
      // changes; the X icon is hidden on them anyway.
      if (rowId.startsWith("state:")) return;

      const previous = rows;
      setRows((prev) => prev.filter((r) => r.id !== rowId));
      const { error } = await clearNotification(rowId);
      if (error) {
        logger.error("Failed to clear notification", { error });
        setRows(previous);
      }
    },
    [rows],
  );

  const handleRowClick = useCallback(
    (row: InboxRow) => {
      // Always navigate (if there's a destination)
      if (row.link) {
        router.push(row.link);
      }

      // Informational kinds clear on click (engaging with the info IS
      // the intentional act). Actionable kinds navigate only — the user
      // does the underlying work and auto-Clear fires from there.
      if (
        row.kind === "event" &&
        row.source_kind &&
        INFORMATIONAL_SOURCE_KINDS.has(
          row.source_kind as NotificationSourceKind,
        )
      ) {
        void handleClear(row.id);
      }
    },
    [router, handleClear],
  );

  const count = rows.length;
  const badgeText = count > 9 ? "9+" : String(count);

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 data-[state=open]:bg-accent motion-safe:hover:scale-105"
        >
          {/* Filled bell when there's something to act on. Outline when
              clear. The fill is the most reliable cross-state signal —
              it pre-loads the badge's "look at me" before the eye even
              registers the count. */}
          <Bell
            className="h-5 w-5"
            {...(count > 0 ? { fill: "currentColor" } : {})}
          />
          {count > 0 && (
            <Badge
              className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 flex items-center justify-center p-0 text-[10px] font-bold bg-red-500 text-white border-0 hover:bg-red-500 shadow-sm"
            >
              {badgeText}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-80 flex flex-col p-0"
        align="end"
        forceMount
      >
        <div className="flex flex-none items-center justify-between px-3 py-1">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            Inbox
          </DropdownMenuLabel>
          {count > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />

        {isLoading ? (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : count === 0 ? (
          <EmptyState line={emptyLine} />
        ) : (
          <ScrollArea className="flex-1 max-h-[580px]">
            <div className="py-1">
              {rows.map((row) => (
                <InboxRowItem
                  key={row.id}
                  row={row}
                  onClick={() => handleRowClick(row)}
                  onClear={() => handleClear(row.id)}
                  onAfterAction={fetchRows}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {count > 0 && (
          <>
            <DropdownMenuSeparator className="m-0" />
            <Link
              href="/notifications"
              className="flex flex-none justify-center px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-b-md"
            >
              View all
            </Link>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Empty state ────────────────────────────────────────────────────

function EmptyState({ line }: { line: string }) {
  return (
    <div className="px-3 py-12 flex flex-col items-center justify-center gap-3 text-center">
      <Inbox
        className="h-8 w-8 text-muted-foreground/40"
        strokeWidth={1.5}
      />
      <p className="text-sm text-muted-foreground">{line}</p>
    </div>
  );
}

// ─── Row component ──────────────────────────────────────────────────

interface InboxRowItemProps {
  row: InboxRow;
  onClick: () => void;
  onClear: () => void;
  onAfterAction: () => void;
}

function InboxRowItem({ row, onClick, onClear, onAfterAction }: InboxRowItemProps) {
  const isStateRow = row.kind === "state";
  const sourceKind = row.source_kind as NotificationSourceKind | null;
  const Icon = sourceKind ? SOURCE_KIND_ICON[sourceKind] : null;
  const actionVerb = sourceKind ? SOURCE_KIND_ACTION_VERB[sourceKind] : null;
  // Working-location state rows render an inline location picker
  // instead of the generic verb button — quick action without leaving
  // the bell. All other rows (event or state) use the verb-button form.
  const isWorkingLocationState =
    isStateRow && sourceKind === "working_location";

  return (
    <div className="group/row relative flex items-start gap-2.5 px-3 py-2.5 hover:bg-accent rounded-sm">
      {/* Icon block — leads the row so a manager scanning sees the
          category before reading the title. Hidden for grandfathered
          rows without a source_kind. */}
      {Icon && (
        <span
          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
          aria-label={row.reason || undefined}
        >
          {createElement(Icon, { className: "h-3.5 w-3.5" })}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={onClick}
          className="text-left w-full"
        >
          <p className="font-medium text-sm leading-tight line-clamp-1">
            {row.title}
          </p>
          {/* Message only renders when it carries content. State rows
              set message to "" because the title says it all; event
              rows keep their detail text (e.g. "John approved your
              leave for 3-5 March"). */}
          {row.message && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {row.message}
            </p>
          )}
        </button>

        {/* Working-location → inline picker (Home / Glasgow / Stevenage
            / Other). Lets the user log location directly from the bell
            without bouncing to /sign-in. */}
        {isWorkingLocationState && (
          <WorkingLocationPicker
            type={row.type as "no_location_set" | "office_arrival_unconfirmed"}
            onAfterAction={onAfterAction}
          />
        )}

        {/* Default verb button for everything else. Click does the same
            as the title click — both paths go through `onClick`. */}
        {!isWorkingLocationState && actionVerb && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {actionVerb}
            <ChevronRight className="h-3 w-3" />
          </button>
        )}

        {!isStateRow && (
          <p className="text-xs text-muted-foreground/70 mt-1">
            {timeAgo(row.created_at)}
          </p>
        )}
      </div>

      {/* Per-row clear (X). Hidden until row hover/focus. State rows
          have no DB id to clear and resolve naturally — no X. */}
      {!isStateRow && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="opacity-0 group-hover/row:opacity-100 focus:opacity-100 transition-opacity flex-shrink-0 p-1 rounded hover:bg-muted-foreground/10"
          aria-label={`Clear ${row.title}`}
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

// ─── Working-location inline picker ──────────────────────────────────

interface WorkingLocationPickerProps {
  type: "no_location_set" | "office_arrival_unconfirmed";
  onAfterAction: () => void;
}

function WorkingLocationPicker({ type, onAfterAction }: WorkingLocationPickerProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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

  if (type === "office_arrival_unconfirmed") {
    return (
      <div
        className="mt-1.5 flex flex-wrap items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <PickerButton onClick={handleConfirm} disabled={isPending}>
          I&apos;m here
        </PickerButton>
        <PickerButton
          onClick={() => handleSet("home", "Home")}
          disabled={isPending}
        >
          Home
        </PickerButton>
      </div>
    );
  }

  // type === "no_location_set"
  return (
    <div
      className="mt-1.5 flex flex-wrap items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <PickerButton
        onClick={() => handleSet("home", "Home")}
        disabled={isPending}
      >
        Home
      </PickerButton>
      <PickerButton
        onClick={() => handleSet("glasgow_office", "Glasgow")}
        disabled={isPending}
      >
        Glasgow
      </PickerButton>
      <PickerButton
        onClick={() => handleSet("stevenage_office", "Stevenage")}
        disabled={isPending}
      >
        Stevenage
      </PickerButton>
      <PickerButton onClick={() => router.push("/sign-in")} disabled={isPending}>
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
      className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}
