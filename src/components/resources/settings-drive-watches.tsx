"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  ExternalLink,
  FileText,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Unlink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UnlinkDialog } from "./unlink-dialog";
import {
  type DriveCronRun,
  type DriveWatchArticle,
  getDriveWatchArticles,
  getRecentDriveCronRuns,
  syncArticle,
  unlinkGoogleDoc,
} from "@/app/(protected)/resources/drive-actions";
import { formatDate, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

const DRIFT_THRESHOLD_MS = 60_000;

type SyncState = "sync-failed" | "never-synced" | "drift" | "in-sync";

// Derive the primary sync state. `sync-failed` wins over everything else
// because if the last attempt failed, drift and in-sync claims are
// unreliable — we couldn't actually compare source and intranet copies.
function deriveSyncState(article: DriveWatchArticle): SyncState {
  if (article.last_sync_error) return "sync-failed";
  if (!article.last_synced_at) return "never-synced";
  if (!article.google_doc_modified_at) return "in-sync";
  const sourceMs = new Date(article.google_doc_modified_at).getTime();
  const syncMs = new Date(article.last_synced_at).getTime();
  return sourceMs > syncMs + DRIFT_THRESHOLD_MS ? "drift" : "in-sync";
}

function StatusBadge({ article }: { article: DriveWatchArticle }) {
  const state = deriveSyncState(article);
  const notWatched =
    article.google_watch_channel_id === null && article.last_synced_at !== null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {state === "in-sync" && (
        <Badge className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200">
          In sync
        </Badge>
      )}
      {state === "drift" && (
        <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200">
          Drift
        </Badge>
      )}
      {state === "never-synced" && (
        <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200 gap-1">
          <AlertCircle className="h-3 w-3" />
          Never synced
        </Badge>
      )}
      {state === "sync-failed" && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-red-50 text-red-700 hover:bg-red-50 border-red-200 gap-1 cursor-help">
                <AlertCircle className="h-3 w-3" />
                Sync failed
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p className="text-xs font-medium">Last sync error</p>
              <p className="text-xs mt-1 whitespace-pre-wrap break-words">
                {article.last_sync_error}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {article.status === "draft" && (
        <Badge variant="secondary" className="font-medium">
          Draft
        </Badge>
      )}
      {notWatched && (
        <Badge
          className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200"
          title="Watch setup failed — this article won't auto-sync until relinked or the next renewal cron picks it up"
        >
          Not watched
        </Badge>
      )}
    </div>
  );
}

function RelativeTimeCell({
  iso,
  fallback = "—",
  className,
}: {
  iso: string | null;
  fallback?: string;
  className?: string;
}) {
  if (!iso) {
    return <span className="text-muted-foreground">{fallback}</span>;
  }
  return (
    <span className={className} title={formatDate(new Date(iso))}>
      {timeAgo(iso)}
    </span>
  );
}

function WatchExpiresCell({
  iso,
  nowMs,
}: {
  iso: string | null;
  nowMs: number;
}) {
  if (!iso) {
    return (
      <span className="text-amber-600 italic" title="No watch channel tracked">
        Not watched
      </span>
    );
  }
  const expiresMs = new Date(iso).getTime();
  const delta = expiresMs - nowMs;
  const twentyFourHours = 24 * 60 * 60 * 1000;
  let className = "text-muted-foreground";
  if (delta < 0) className = "text-red-600";
  else if (delta < twentyFourHours) className = "text-amber-600";
  return (
    <span className={className} title={formatDate(new Date(iso))}>
      {timeAgo(iso)}
    </span>
  );
}

function RowActions({
  article,
  onRefresh,
}: {
  article: DriveWatchArticle;
  onRefresh: () => void;
}) {
  const [isSyncing, startSync] = useTransition();
  const [isUnlinking, startUnlink] = useTransition();
  const [unlinkOpen, setUnlinkOpen] = useState(false);

  function handleSync() {
    startSync(async () => {
      const result = await syncArticle(article.id);
      if (result.success) {
        toast.success("Article synced");
        onRefresh();
      } else {
        toast.error(result.error ?? "Sync failed");
      }
    });
  }

  function handleUnlink() {
    startUnlink(async () => {
      const result = await unlinkGoogleDoc(article.id);
      if (result.success) {
        toast.success("Article unlinked");
        setUnlinkOpen(false);
        onRefresh();
      } else {
        toast.error(result.error ?? "Unlink failed");
      }
    });
  }

  const isBusy = isSyncing || isUnlinking;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isBusy}
            aria-label={`Actions for ${article.title}`}
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              handleSync();
            }}
            disabled={isBusy}
          >
            <RefreshCw className="h-4 w-4" />
            Sync now
          </DropdownMenuItem>
          {article.google_doc_url && (
            <DropdownMenuItem asChild>
              <a
                href={article.google_doc_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                Open in Drive
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setUnlinkOpen(true)}
          >
            <Unlink className="h-4 w-4" />
            Unlink
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <UnlinkDialog
        articleTitle={article.title}
        onConfirm={handleUnlink}
        disabled={isUnlinking}
        open={unlinkOpen}
        onOpenChange={setUnlinkOpen}
      />
    </>
  );
}

// ─── Cron run formatting ───────────────────────────────────────────────────

function cronStatusBadge(status: DriveCronRun["status"]) {
  if (status === "success") {
    return (
      <Badge className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200">
        success
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge className="bg-red-50 text-red-700 hover:bg-red-50 border-red-200">
        failed
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200">
      running
    </Badge>
  );
}

function cronDuration(run: DriveCronRun): string {
  if (!run.finished_at) return "—";
  const ms =
    new Date(run.finished_at).getTime() - new Date(run.started_at).getTime();
  if (ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function cronResultSummary(result: DriveCronRun["result"]): React.ReactNode {
  if (!result) return <span className="text-muted-foreground">—</span>;
  const renewed =
    typeof result.renewed === "number" ? result.renewed : undefined;
  const failed = typeof result.failed === "number" ? result.failed : undefined;
  const total = typeof result.total === "number" ? result.total : undefined;
  const scaleWarning = result.scaleWarning === true;

  if (total === undefined || total === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const renewedLabel = renewed !== undefined ? `${renewed}/${total}` : "?";
  const failedLabel =
    failed !== undefined && failed > 0 ? `, ${failed} failed` : "";
  return (
    <span className="inline-flex items-center gap-1">
      {renewedLabel} renewed{failedLabel}
      {scaleWarning && (
        <span
          className="text-amber-600"
          title="Approaching scale threshold — see memory/feedback_supabase_cron.md"
        >
          ⚠
        </span>
      )}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function SettingsDriveWatches() {
  const [articles, setArticles] = useState<DriveWatchArticle[]>([]);
  const [runs, setRuns] = useState<DriveCronRun[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(true);
  const [articlesError, setArticlesError] = useState<string | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  // Captured once per component instance — used for expiry colour coding in
  // WatchExpiresCell. Keeps the component pure (no Date.now() during render)
  // and avoids re-render churn. Slightly stale after a long-open session;
  // re-navigation remounts and refreshes it. Fine for a diagnostic view.
  const [nowMs] = useState(() => Date.now());

  async function loadArticles() {
    setArticlesLoading(true);
    setArticlesError(null);
    const result = await getDriveWatchArticles();
    if (result.success) {
      setArticles(result.articles);
    } else {
      setArticlesError(result.error);
    }
    setArticlesLoading(false);
  }

  async function loadRuns() {
    setRunsLoading(true);
    setRunsError(null);
    const result = await getRecentDriveCronRuns();
    if (result.success) {
      setRuns(result.runs);
    } else {
      setRunsError(result.error);
    }
    setRunsLoading(false);
  }

  useEffect(() => {
    // Initial load — state already has loading=true, so we don't need to
    // set it again. Matches the .then() pattern used by settings-folders.tsx
    // so the lint rule against synchronous setState in effects stays happy.
    getDriveWatchArticles().then((result) => {
      if (result.success) {
        setArticles(result.articles);
      } else {
        setArticlesError(result.error);
      }
      setArticlesLoading(false);
    });
    getRecentDriveCronRuns().then((result) => {
      if (result.success) {
        setRuns(result.runs);
      } else {
        setRunsError(result.error);
      }
      setRunsLoading(false);
    });
  }, []);

  // Columns closure depends on nowMs and the load functions. React Compiler
  // handles memoisation; explicit useMemo was flagged for inconsistent deps.
  const columns: ColumnDef<DriveWatchArticle>[] = [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Title" />
        ),
        cell: ({ row }) => {
          const article = row.original;
          return (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={`/resources/article/${article.slug}`}
                    className="inline-flex items-center gap-1.5 font-medium hover:underline max-w-[32ch] truncate"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{article.title}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{article.title}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge article={row.original} />,
      },
      {
        accessorFn: (row) =>
          row.last_synced_at ? new Date(row.last_synced_at).getTime() : 0,
        id: "synced",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Synced" />
        ),
        cell: ({ row }) => (
          <RelativeTimeCell
            iso={row.original.last_synced_at}
            fallback="Never"
            className={
              row.original.last_synced_at ? undefined : "text-amber-600"
            }
          />
        ),
      },
      {
        accessorFn: (row) =>
          row.google_doc_modified_at
            ? new Date(row.google_doc_modified_at).getTime()
            : 0,
        id: "sourceEdited",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Source edited" />
        ),
        cell: ({ row }) => (
          <RelativeTimeCell
            iso={row.original.google_doc_modified_at}
            fallback="Unknown"
          />
        ),
      },
      {
        accessorFn: (row) =>
          row.google_watch_expires_at
            ? new Date(row.google_watch_expires_at).getTime()
            : Number.MAX_SAFE_INTEGER,
        id: "expires",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Watch expires" />
        ),
        cell: ({ row }) => (
          <WatchExpiresCell
            iso={row.original.google_watch_expires_at}
            nowMs={nowMs}
          />
        ),
      },
      {
        // Hidden column used as the primary sort key so attention-needed rows
        // (failed/never-synced/drift/not-watched) cluster at the top. Renders
        // nothing — only affects default ordering. User-chosen column sorts
        // still replace this as expected (single-column sort on click).
        id: "attention",
        accessorFn: (row) => {
          if (row.last_sync_error) return 5;
          if (row.last_synced_at === null) return 4;
          const synced = new Date(row.last_synced_at).getTime();
          const edited = row.google_doc_modified_at
            ? new Date(row.google_doc_modified_at).getTime()
            : null;
          if (edited !== null && edited > synced + DRIFT_THRESHOLD_MS) return 3;
          if (row.google_watch_channel_id === null) return 2;
          return 1;
        },
        enableHiding: true,
        header: () => null,
        cell: () => null,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActions
              article={row.original}
              onRefresh={() => {
                loadArticles();
                loadRuns();
              }}
            />
          </div>
        ),
      },
  ];

  return (
    <div className="space-y-8">
      {/* Linked Google Docs */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Linked Google Docs
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1">
            Every article synced from Google Drive, with its current watch
            state. Expand a row&apos;s actions to sync, open in Drive, or unlink.
          </p>
        </div>
        {articlesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading linked Google Docs…
          </div>
        ) : articlesError ? (
          <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-3">
            {articlesError}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-sm text-muted-foreground italic py-6">
            No linked Google Docs yet. Link a doc from a category page to see
            it here.
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={articles}
            searchKey="title"
            searchPlaceholder="Search by title…"
            initialSorting={[
              { id: "attention", desc: true },
              { id: "expires", desc: false },
            ]}
            initialColumnVisibility={{ attention: false }}
            pageSize={25}
          />
        )}
      </section>

      {/* Recent renewal runs */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Recent renewal runs
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1">
            Last {runs.length || 20} invocations of the{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              renew-drive-watches
            </code>{" "}
            Supabase cron job. Triggers nightly at 03:00 UTC.
          </p>
        </div>
        {runsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading recent cron runs…
          </div>
        ) : runsError ? (
          <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-3">
            {runsError}
          </div>
        ) : runs.length === 0 ? (
          <div className="text-sm text-muted-foreground italic py-6">
            No renewal runs recorded. Next scheduled run is nightly at 03:00 UTC.
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-clip">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-background odd:bg-background">
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <RelativeTimeCell iso={run.started_at} />
                    </TableCell>
                    <TableCell>{cronStatusBadge(run.status)}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {cronDuration(run)}
                    </TableCell>
                    <TableCell>{cronResultSummary(run.result)}</TableCell>
                    <TableCell className="max-w-[30ch]">
                      {run.error ? (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block text-destructive">
                                {run.error}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md">
                              {run.error}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
