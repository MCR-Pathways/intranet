import { getNotificationsByTab } from "./actions";
import { NotificationsPage } from "@/components/notifications/notifications-page";
import { EMPTY_INBOX_COPY } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// Helper isolated so the react-hooks/purity rule (client-component
// guidance) doesn't fire inside the server component body. Server-
// side Math.random per request is the intended behaviour.
function pickRandomEmptyLine(): string {
  return EMPTY_INBOX_COPY[
    Math.floor(Math.random() * EMPTY_INBOX_COPY.length)
  ];
}

export default async function NotificationsRoute() {
  // Default landing tab is Inbox (locked decision). Server prefetches
  // Inbox rows + counts so first paint has data; client component
  // takes over for tab switches and row-level actions.
  const result = await getNotificationsByTab("inbox");

  // Server picks the empty-state line so SSR and hydration agree on
  // the same string (Math.random in a client useMemo/useEffect
  // produces a hydration mismatch). The page is `force-dynamic` so
  // every visit re-rolls; the client only re-rolls on tab switch.
  // react-hooks/purity is a client-component lint rule firing on a
  // server component here — server-side per-request random is
  // intentional, not a memoisation hazard.
  const initialEmptyLine = pickRandomEmptyLine();

  return (
    <NotificationsPage
      initialTab="inbox"
      initialRows={result.rows}
      initialCounts={result.counts}
      initialTruncated={result.truncated}
      initialEmptyLine={initialEmptyLine}
    />
  );
}
