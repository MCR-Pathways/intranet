import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { getNotifications } from "@/app/(protected)/notifications/actions";
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

  // Fetch notifications server-side so revalidatePath refreshes the bell.
  let initialNotifications;
  try {
    const { notifications } = await getNotifications();
    initialNotifications = notifications;
  } catch (e) {
    logger.error("Failed to fetch notifications", { error: e });
  }

  return (
    <TooltipProvider>
      <AppLayout
        user={user}
        profile={profile as unknown as Profile}
        initialNotifications={initialNotifications}
      >
        {children}
      </AppLayout>
    </TooltipProvider>
  );
}
