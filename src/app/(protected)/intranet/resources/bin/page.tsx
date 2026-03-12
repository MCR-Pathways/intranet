import { redirect } from "next/navigation";
import { getCurrentUser, isHRAdminEffective, isContentEditorEffective } from "@/lib/auth";
import { fetchTrashedItems } from "../actions";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceBin } from "@/components/resources/resource-bin";

export default async function ResourceBinPage() {
  const { user, profile } = await getCurrentUser();
  if (!user || !profile) redirect("/login");

  const canEdit = isHRAdminEffective(profile) || isContentEditorEffective(profile);
  if (!canEdit) redirect("/intranet/resources");

  const { articles, categories } = await fetchTrashedItems();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bin"
        subtitle="Deleted resources — items are automatically removed after 30 days"
        breadcrumbs={[
          { label: "Home", href: "/intranet" },
          { label: "Resources", href: "/intranet/resources" },
          { label: "Bin" },
        ]}
      />

      <ResourceBin articles={articles} categories={categories} />
    </div>
  );
}
