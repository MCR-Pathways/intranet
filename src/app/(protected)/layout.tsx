import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { getInboxStream } from "@/app/(protected)/notifications/actions";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Profile } from "@/types/database.types";
import type { InboxRow } from "@/types/notification";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the inbox stream for the bell's initial render. The DailyBanner
  // retired in W3-rev.4; working-location prompts now live in the bell as
  // state rows via getInboxStream → getOfficeArrivalConfirmation.
  let initialInboxRows: InboxRow[] | undefined;
  try {
    const inboxResult = await getInboxStream();
    initialInboxRows = inboxResult.rows;
  } catch (e) {
    logger.error("Failed to fetch layout data", { error: e });
  }

  return (
    <TooltipProvider>
      <AppLayout
        user={user}
        profile={profile as unknown as Profile}
        initialInboxRows={initialInboxRows}
      >
        {children}
      </AppLayout>
    </TooltipProvider>
  );
}
