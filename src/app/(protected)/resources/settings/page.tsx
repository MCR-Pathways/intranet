import { redirect } from "next/navigation";
import {
  getCurrentUser,
  isHRAdminEffective,
  isContentEditorEffective,
} from "@/lib/auth";
import { ResourcesSettings } from "@/components/resources/resources-settings";

export default async function ResourcesSettingsPage() {
  const { user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const canEdit =
    isHRAdminEffective(profile) || isContentEditorEffective(profile);

  if (!canEdit) redirect("/resources");

  return <ResourcesSettings />;
}
