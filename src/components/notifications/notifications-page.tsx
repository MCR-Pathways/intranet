"use client";

import { useMemo, useState, useTransition } from "react";
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
  initialCounts: { inbox: number; saved: number; cleared: number };
  initialTruncated: boolean;
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
}: NotificationsPageProps) {
  const [tab, setTab] = useState<NotificationTab>(initialTab);
  const [filter, setFilter] = useState<ModuleFilter>("all");
  const [rows, setRows] = useState<InboxRow[]>(initialRows);
  const [counts, setCounts] = useState(initialCounts);
  const [truncated, setTruncated] = useState(initialTruncated);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [, startTransition] = useTransition();
  // Pick an empty-state line per page-load. Saved + Cleared have only
  // 3 variants because those tabs are visited far less than Inbox.
  const emptyLine = useMemo(() => {
    const pool =
      tab === "inbox"
        ? EMPTY_INBOX_COPY
        : tab === "saved"
          ? EMPTY_SAVED_COPY
          : EMPTY_CLEARED_COPY;
    /* eslint-disable-next-line react-hooks/purity -- intentional one-shot pick per tab */
    return pool[Math.floor(Math.random() * pool.length)];
  }, [tab]);

  const fetchTab = async (nextTab: NotificationTab) => {
    setIsLoading(true);
    const result = await getNotificationsByTab(nextTab);
    setIsLoading(false);
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
  // restore / unsave). Keeps tab counts and the row list in sync.
  const refresh = () => {
    void fetchTab(tab);
  };

  const handleClearAll = () => {
    startTransition(async () => {
      const result = await clearAllNotifications();
      if (result.success) {
        toast.success(`Cleared ${counts.inbox} notification${counts.inbox === 1 ? "" : "s"}`);
        setConfirmOpen(false);
        refresh();
      } else {
        toast.error(result.error ?? "Failed to clear notifications");
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
        {tab === "inbox" && counts.inbox > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Inbox actions"
                className="data-[state=open]:bg-accent"
              >
                <MoreHorizontal className="h-5 w-5" />
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
                Showing the most recent 500 notifications.
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
              Clear all {counts.inbox} notification{counts.inbox === 1 ? "" : "s"} in Inbox?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You can find them in Cleared for 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
          Head back to the feed →
        </Link>
      )}
    </div>
  );
}
