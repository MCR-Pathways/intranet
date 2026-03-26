import {
  getCurrentUser,
  isHRAdminEffective,
  isContentEditorEffective,
} from "@/lib/auth";
import { redirect } from "next/navigation";
import { ResourcesShell } from "@/components/resources/resources-shell";

export default async function ResourcesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const canEdit =
    isHRAdminEffective(profile) || isContentEditorEffective(profile);

  return (
    <ResourcesShell canEdit={canEdit}>
      {children}
    </ResourcesShell>
  );
}
