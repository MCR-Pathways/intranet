import { getCurrentUser, isHRAdminEffective } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ComplianceDashboard } from "@/components/hr/compliance-dashboard";
import { PageHeader } from "@/components/layout/page-header";
import type { ComplianceStatus } from "@/lib/hr";

/** Select columns for compliance_documents joined with type + profile. */
const COMPLIANCE_DOCS_SELECT =
  "id, profile_id, document_type_id, reference_number, issue_date, expiry_date, status, file_name, verified_at, compliance_document_types(name), profiles!profile_id(full_name, department)";

export default async function CompliancePage() {
  const { supabase, profile } = await getCurrentUser();
  if (!isHRAdminEffective(profile)) {
    redirect("/hr");
  }

  // Fetch active document types
  const { data: documentTypes } = await supabase
    .from("compliance_document_types")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  // Fetch all compliance documents with joined type name and employee profile
  const { data: rawDocs } = await supabase
    .from("compliance_documents")
    .select(COMPLIANCE_DOCS_SELECT)
    .order("expiry_date");

  // Fetch all active employees for the status grid
  const { data: activeProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, department")
    .eq("status", "active")
    .order("full_name");

  const types = (documentTypes ?? []).map((dt) => ({
    id: dt.id as string,
    name: dt.name as string,
  }));

  // Flatten documents for the table
  const documents = (rawDocs ?? []).map((doc) => {
    const docType = doc.compliance_document_types as unknown as { name: string } | null;
    const profile = doc.profiles as unknown as { full_name: string; department: string | null } | null;
    return {
      id: doc.id as string,
      profile_id: doc.profile_id as string,
      document_type_id: doc.document_type_id as string,
      document_type_name: docType?.name ?? "Unknown",
      employee_name: profile?.full_name ?? "Unknown",
      department: profile?.department ?? null,
      status: doc.status as ComplianceStatus,
      issue_date: doc.issue_date as string | null,
      expiry_date: doc.expiry_date as string | null,
      reference_number: doc.reference_number as string | null,
      file_name: doc.file_name as string | null,
      verified_at: doc.verified_at as string | null,
    };
  });

  // Compute summary counts
  const summary = {
    total: documents.length,
    valid: documents.filter((d) => d.status === "valid").length,
    expiring_soon: documents.filter((d) => d.status === "expiring_soon").length,
    expired: documents.filter((d) => d.status === "expired").length,
  };

  // Build status map in a single pass over documents — O(D) instead of O(P×D)
  const employeeStatusMap = new Map<string, Record<string, ComplianceStatus>>();
  for (const doc of documents) {
    const profileStatuses = employeeStatusMap.get(doc.profile_id) ?? {};
    const existing = profileStatuses[doc.document_type_id];
    if (!existing || statusPriority(doc.status) > statusPriority(existing)) {
      profileStatuses[doc.document_type_id] = doc.status;
    }
    employeeStatusMap.set(doc.profile_id, profileStatuses);
  }

  const employeeGrid = (activeProfiles ?? []).map((profile) => ({
    profile_id: profile.id as string,
    full_name: profile.full_name as string,
    department: profile.department as string | null,
    statuses: employeeStatusMap.get(profile.id as string) ?? {},
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance Documents"
        subtitle="Track and manage compliance documents across the organisation"
        breadcrumbs={[
          { label: "Admin", href: "/hr" },
          { label: "Compliance" },
        ]}
      />

      <ComplianceDashboard
        documentTypes={types}
        documents={documents}
        employeeGrid={employeeGrid}
        summary={summary}
      />
    </div>
  );
}

/** Higher number = better status (for resolving duplicates). */
function statusPriority(status: ComplianceStatus): number {
  switch (status) {
    case "valid":
      return 4;
    case "pending_renewal":
      return 3;
    case "expiring_soon":
      return 2;
    case "expired":
      return 1;
    case "not_applicable":
    default:
      return 0;
  }
}
