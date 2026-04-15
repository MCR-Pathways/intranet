import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ResourcesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  // Permission checks happen inside each page component (canEdit / canViewDrafts
  // are derived in page.tsx and [...slug]/page.tsx). Layout stays thin.
  return <>{children}</>;
}
