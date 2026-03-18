import {
  getCurrentUser,
  isHRAdminEffective,
  isContentEditorEffective,
} from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchCategoryTreeWithClient } from "./actions";
import { ResourcesShell } from "@/components/resources/resources-shell";

export default async function ResourcesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const canEdit =
    isHRAdminEffective(profile) || isContentEditorEffective(profile);
  const categories = await fetchCategoryTreeWithClient(supabase);

  return (
    <ResourcesShell categories={categories} canEdit={canEdit}>
      {children}
    </ResourcesShell>
  );
}
