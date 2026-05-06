export interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean | null;
  read_at: string | null;
  created_at: string | null;
  source_kind: string | null;
  source_id: string | null;
  is_cleared: boolean;
  cleared_at: string | null;
}

/**
 * Unified inbox row consumed by W3-rev.2's bell + popover. Merges DB
 * notifications (kind: "event") with persistent-state computed items
 * (kind: "state"). Persistent-state items have synthetic ids and never
 * carry an is_cleared flag (they auto-resolve when the underlying state
 * changes, so there's nothing to clear).
 */
export interface InboxRow {
  id: string;
  kind: "event" | "state";
  source_kind: string | null;
  source_id: string | null;
  type: string;
  title: string;
  message: string;
  link: string | null;
  /** Sortable timestamp. For events this is `notifications.created_at`; for state items it's the moment the state became attention-worthy. */
  created_at: string;
  /** Always false for state items (they're computed live, no clear). */
  is_cleared: boolean;
  /** Reason-pill label for the row (e.g. "Leave request", "Compliance overdue"). */
  reason: string;
  /** Optional count for state items: "3 leave requests waiting" → count = 3. */
  count?: number;
}
