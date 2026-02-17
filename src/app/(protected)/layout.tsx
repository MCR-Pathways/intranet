import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { checkAndCreateSignInNudge } from "@/app/(protected)/sign-in/actions";
import { getNotifications } from "@/app/(protected)/notifications/actions";
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

  // Check if staff user needs sign-in nudge (also creates notification if needed).
  // Idempotent: checks for existing unread reminder before creating a new one.
  // Wrapped in try/catch so notification failures never break layout rendering.
  let needsSignIn = false;
  try {
    needsSignIn = await checkAndCreateSignInNudge();
  } catch (e) {
    console.error("Sign-in nudge check failed:", e);
  }

  // Fetch notifications server-side so revalidatePath refreshes the bell.
  // After recordSignIn() dismisses reminders and calls revalidatePath("/", "layout"),
  // this re-runs and passes fresh data down to NotificationBell.
  let initialNotifications;
  try {
    const { notifications } = await getNotifications();
    initialNotifications = notifications;
  } catch (e) {
    console.error("Failed to fetch notifications:", e);
  }

  return (
    <AppLayout
      user={user}
      profile={profile as Profile}
      needsSignIn={needsSignIn}
      initialNotifications={initialNotifications}
    >
      {children}
    </AppLayout>
  );
}
