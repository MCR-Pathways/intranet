import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { checkAndCreateSignInNudge } from "@/app/(protected)/sign-in/actions";
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

  return (
    <AppLayout user={user} profile={profile as Profile} needsSignIn={needsSignIn}>
      {children}
    </AppLayout>
  );
}
