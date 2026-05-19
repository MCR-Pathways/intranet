"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Inbox, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  EMPTY_INBOX_COPY,
  EMPTY_SAVED_COPY,
  EMPTY_CLEARED_COPY,
  MODULE_LABELS,
  MODULE_ORDER,
  SOURCE_KIND_MODULE,
  type NotificationModule,
  type NotificationSourceKind,
} from "@/lib/notifications";
import {
  clearAllNotifications,
  getNotificationsByTab,
  type NotificationTab,
} from "@/app/(protected)/notifications/actions";
import { NotificationRow } from "@/components/notifications/notification-row";
import type { InboxRow } from "@/types/notification";
import { toast } from "sonner";

interface NotificationsPageProps {
  initialTab: NotificationTab;
  initialRows: InboxRow[];
  initialCounts: { inbox: number; saved: number; cleared: number; inboxClearable: number };
  initialTruncated: boolean;
  /** Server-picked empty-state line for the initial Inbox tab. Passed as
   *  a prop so server and client agree at hydration time — pure
   *  client-side Math.random in useMemo/useEffect causes a mismatch. */
  initialEmptyLine: string;
}

const TABS: { id: NotificationTab; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "saved", label: "Saved" },
  { id: "cleared", label: "Cleared" },
];

type ModuleFilter = "all" | NotificationModule;

export function NotificationsPage({
  initialTab,
  initialRows,
  initialCounts,
  initialTruncated,
  initialEmptyLine,
}: NotificationsPageProps) {
  const [tab, setTab] = useState<NotificationTab>(initialTab);
  const [filter, setFilter] = useState<ModuleFilter>("all");
  const [rows, setRows] = useState<InboxRow[]>(initialRows);
  const [counts, setCounts] = useState(initialCounts);
  const [truncated, setTruncated] = useState(initialTruncated);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Race-condition guard: rapid tab switches can produce out-of-order
  // settles where a slower fetch overwrites a faster one. Each call
  // bumps the ref; only the latest call writes back to state.
  const lastRequestRef = useRef(0);
  // Track first render so we don't blow away the server-picked
  // initialEmptyLine with a re-roll on mount. Only re-roll on actual
  // tab switches.
  const isFirstRenderRef = useRef(true);
  // Initial value comes from the server (prop) so SSR and hydration
  // agree on the same line — no flash of pool[0]. Re-roll after a
  // real tab switch (client-side; no hydration concern post-mount).
  const [emptyLine, setEmptyLine] = useState<string>(initialEmptyLine);
  /* eslint-disable react-hooks/set-state-in-effect -- random pick after tab switch */
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    const pool =
      tab === "inbox"
        ? EMPTY_INBOX_COPY
        : tab === "saved"
          ? EMPTY_SAVED_COPY
          : EMPTY_CLEARED_COPY;
    setEmptyLine(pool[Math.floor(Math.random() * pool.length)]);
  }, [tab]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // `showLoading` defaults to true — set false for "silent" refetches
  // after row actions so the list doesn't flash to the loading state
  // every time a user saves/clears one row.
  const fetchTab = async (
    nextTab: NotificationTab,
    options: { showLoading?: boolean } = {},
  ) => {
    const showLoading = options.showLoading ?? true;
    const requestId = ++lastRequestRef.current;
    if (showLoading) setIsLoading(true);
    const result = await getNotificationsByTab(nextTab);
    // Discard out-of-order settles: a previous-tab fetch resolving
    // after a newer tab switch would overwrite the current state.
    if (requestId !== lastRequestRef.current) return;
    if (showLoading) setIsLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setRows(result.rows);
    setCounts(result.counts);
    setTruncated(result.truncated);
  };

  // Tab switch resets the filter to All (locked decision — pills are
  // tab-scoped, not persisted).
  const handleTabSwitch = (nextTab: NotificationTab) => {
    if (nextTab === tab) return;
    setTab(nextTab);
    setFilter("all");
    void fetchTab(nextTab);
  };

  // Refetch the current tab after any row-level action (save / clear /
  // restore / unsave). `showLoading: false` so the user doesn't see
  // a "Loading…" flash for a single row's worth of state churn.
  const refresh = () => {
    void fetchTab(tab, { showLoading: false });
  };

  const handleClearAll = () => {
    startTransition(async () => {
      try {
        const result = await clearAllNotifications();
        if (result.success) {
          toast.success(
            `Cleared ${counts.inboxClearable} notification${counts.inboxClearable === 1 ? "" : "s"}`,
          );
          setConfirmOpen(false);
          refresh();
        } else {
          toast.error(result.error ?? "Failed to clear notifications");
        }
      } catch {
        // Network failure or unhandled throw mid-transition. Same
        // shape as the row-level wrap() — server actions usually
        // return {error}, but the fetch can still drop.
        toast.error("Something went wrong. Please try again.");
      }
    });
  };

  // Filter pills + per-pill counts derived from the current tab's rows.
  // Pills with zero matching rows are hidden (no greyed-out empty pills).
  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((row) => {
      if (!row.source_kind) return false;
      return SOURCE_KIND_MODULE[row.source_kind as NotificationSourceKind] === filter;
    });
  }, [rows, filter]);

  const moduleCounts = useMemo(() => {
    const out: Record<NotificationModule, number> = {
      hr: 0,
      learning: 0,
      news: 0,
      mentions: 0,
      signin: 0,
    };
    for (const row of rows) {
      if (!row.source_kind) continue;
      const m = SOURCE_KIND_MODULE[row.source_kind as NotificationSourceKind];
      if (m) out[m] += 1;
    }
    return out;
  }, [rows]);

  const visibleModules = MODULE_ORDER.filter((m) => moduleCounts[m] > 0);

  const isInboxEmpty = tab === "inbox" && rows.length === 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      {/* Page header — bare H1 + page-level kebab. Kebab is Inbox-only
          and only when there's something to clear. No subtitle: the
          page is self-evident; every inbox we looked at (GitHub,
          Linear, Slack, Notion, Asana, Teams, BambooHR) ships without
          one. */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {tab === "inbox" && counts.inboxClearable > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Inbox actions"
                className="data-[state=open]:bg-accent"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmOpen(true);
                }}
              >
                Clear all in Inbox
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Tabs — counts are inline muted numbers, not chips. The tab
          label IS the navigation; count is a quiet companion, not a
          competing visual element. Always rendered (even when 0) so
          the row stays even and counts feel like part of the label. */}
      <div className="border-b border-border mt-4">
        <div className="flex items-center gap-5">
          {TABS.map((t) => {
            const count = counts[t.id];
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTabSwitch(t.id)}
                className={cn(
                  "relative pb-2 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "ml-1.5 text-xs font-normal tabular-nums",
                    active ? "text-muted-foreground" : "text-muted-foreground/70",
                  )}
                >
                  {count}
                </span>
                {active && (
                  <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter pills — source-only, hide pills with zero matches.
          "All" is always visible but has no count (would duplicate the
          tab count two pixels away). Module pills carry an inline
          muted count after the label. Active state is a subtle
          accent fill — softer than the tab's underline indicator so
          the visual hierarchy reads tabs > pills. */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <FilterPill label="All" active={filter === "all"} onClick={() => setFilter("all")} />
          {visibleModules.map((m) => (
            <FilterPill
              key={m}
              label={MODULE_LABELS[m]}
              count={moduleCounts[m]}
              active={filter === m}
              onClick={() => setFilter(m)}
            />
          ))}
        </div>
      )}

      {/* Row list / loading / empty state */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-clip mt-3">
        {isLoading ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            line={emptyLine}
            showHomeCta={isInboxEmpty}
          />
        ) : (
          <>
            <div className="divide-y divide-border">
              {filteredRows.map((row) => (
                <NotificationRow
                  key={row.id}
                  row={row}
                  tab={tab}
                  onAfterAction={refresh}
                />
              ))}
            </div>
            {truncated && (
              <p className="px-4 py-3 text-xs text-muted-foreground border-t border-border text-center">
                Showing the most recent notifications.
              </p>
            )}
          </>
        )}
      </div>

      {/* Clear-all confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Clear all {counts.inboxClearable} notification{counts.inboxClearable === 1 ? "" : "s"} in Inbox?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You can find them in Cleared for 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              disabled={isPending}
              aria-busy={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all"
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface FilterPillProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

function FilterPill({ label, count, active, onClick }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 rounded-full px-2.5 text-xs font-medium transition-colors",
        active
          ? "bg-accent text-foreground border border-foreground/20"
          : "bg-muted text-muted-foreground border border-transparent hover:text-foreground",
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "ml-1.5 tabular-nums text-[11px] font-normal",
            active ? "text-muted-foreground" : "text-muted-foreground/70",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyState({ line, showHomeCta }: { line: string; showHomeCta: boolean }) {
  return (
    <div className="px-4 py-16 flex flex-col items-center justify-center gap-3 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
      <p className="text-sm text-muted-foreground max-w-md">{line}</p>
      {showHomeCta && (
        <Link
          href="/intranet"
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          ← Head back to the feed
        </Link>
      )}
    </div>
  );
}
