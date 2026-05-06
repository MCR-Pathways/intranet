import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { getInboxStream } from "@/app/(protected)/notifications/actions";
import { getDailyBannerState } from "@/app/(protected)/sign-in/actions";
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

  // Fetch inbox stream + daily banner state in parallel.
  let initialInboxRows: InboxRow[] | undefined;
  let bannerState: string | null = null;
  try {
    const [inboxResult, bannerResult] = await Promise.all([
      getInboxStream(),
      getDailyBannerState(),
    ]);
    initialInboxRows = inboxResult.rows;
    bannerState = bannerResult.type;
  } catch (e) {
    logger.error("Failed to fetch layout data", { error: e });
  }

  return (
    <TooltipProvider>
      <AppLayout
        user={user}
        profile={profile as unknown as Profile}
        initialInboxRows={initialInboxRows}
        dailyBannerType={bannerState}
      >
        {children}
      </AppLayout>
    </TooltipProvider>
  );
}
