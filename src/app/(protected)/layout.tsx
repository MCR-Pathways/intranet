import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { getNotifications } from "@/app/(protected)/notifications/actions";
import { getDailyBannerState } from "@/app/(protected)/sign-in/actions";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Profile } from "@/types/database.types";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch notifications + daily banner state in parallel
  let initialNotifications;
  let bannerState: string | null = null;
  try {
    const [notifResult, bannerResult] = await Promise.all([
      getNotifications(),
      getDailyBannerState(),
    ]);
    initialNotifications = notifResult.notifications;
    bannerState = bannerResult.type;
  } catch (e) {
    logger.error("Failed to fetch layout data", { error: e });
  }

  return (
    <TooltipProvider>
      <AppLayout
        user={user}
        profile={profile as unknown as Profile}
        initialNotifications={initialNotifications}
        dailyBannerType={bannerState}
      >
        {children}
      </AppLayout>
    </TooltipProvider>
  );
}
