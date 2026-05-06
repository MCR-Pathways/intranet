import { getNotificationsByTab } from "./actions";
import { NotificationsPage } from "@/components/notifications/notifications-page";

export const dynamic = "force-dynamic";

export default async function NotificationsRoute() {
  // Default landing tab is Inbox (locked decision). Server prefetches
  // Inbox rows + counts so first paint has data; client component
  // takes over for tab switches and row-level actions.
  const result = await getNotificationsByTab("inbox");

  return (
    <NotificationsPage
      initialTab="inbox"
      initialRows={result.rows}
      initialCounts={result.counts}
      initialTruncated={result.truncated}
    />
  );
}
