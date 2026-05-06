"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getInboxStream,
  clearNotification,
  clearAllNotifications,
} from "@/app/(protected)/notifications/actions";
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
import { Bell, Inbox, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/utils";
import { logger } from "@/lib/logger";
import {
  EMPTY_INBOX_COPY,
  INFORMATIONAL_SOURCE_KINDS,
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

  // One empty-state line per page-load — re-renders within the session
  // keep the same line, refresh picks a new one. react-hooks/purity is
  // conservative about Math.random, but we genuinely want a one-shot
  // random pick that's stable for the component's lifetime (memoised via
  // empty deps).
  /* eslint-disable react-hooks/purity -- intentional one-shot random pick */
  const emptyLine = useMemo(
    () => EMPTY_INBOX_COPY[Math.floor(Math.random() * EMPTY_INBOX_COPY.length)],
    [],
  );
  /* eslint-enable react-hooks/purity */

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

  useEffect(() => {
    if (initialRows === undefined) return;
    setRows(initialRows);
    setIsLoading(false);
  }, [initialRows]);

  useEffect(() => {
    if (hasInitialData) return;
    fetchRows();
  }, [fetchRows, hasInitialData]);

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
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
        <div className="flex flex-none items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            Inbox
          </DropdownMenuLabel>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={handleClearAll}
            >
              Clear all
            </Button>
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
}

function InboxRowItem({ row, onClick, onClear }: InboxRowItemProps) {
  const isStateRow = row.kind === "state";

  return (
    <div className="group/row relative flex items-start gap-2 px-3 py-2.5 hover:bg-accent rounded-sm">
      {/* Reason pill — leads the row so a manager scanning sees the
          category before reading the title. Hidden when source_kind is
          missing (grandfathered notifications): a pill saying
          "Notification" on a notification row is noise, not signal. */}
      {row.reason && (
        <span className="mt-0.5 inline-flex shrink-0 items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {row.reason}
        </span>
      )}

      <button
        type="button"
        onClick={onClick}
        className="flex-1 min-w-0 text-left"
      >
        <p className="font-medium text-sm leading-tight line-clamp-1">
          {row.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {row.message}
        </p>
        {!isStateRow && (
          <p className="text-xs text-muted-foreground/70 mt-1">
            {timeAgo(row.created_at)}
          </p>
        )}
      </button>

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
