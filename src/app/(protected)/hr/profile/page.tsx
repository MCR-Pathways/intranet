import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProfilePageContent } from "@/components/hr/profile-page-content";
import type { ComplianceStatus } from "@/lib/hr";

/** Select columns for employee_details (excluding sensitive auth fields). */
const EMPLOYEE_DETAILS_SELECT =
  "id, profile_id, date_of_birth, gender, pronouns, nationality, address_line_1, address_line_2, city, postcode, country, personal_email, personal_phone, ni_number";

/** Select columns for emergency_contacts. */
const EMERGENCY_CONTACTS_SELECT =
  "id, profile_id, full_name, relationship, phone_primary, phone_secondary, email, sort_order";

/** Select columns for employment_history. */
const EMPLOYMENT_HISTORY_SELECT =
  "id, profile_id, event_type, effective_date, previous_value, new_value, notes, recorded_by, created_at";

/** Select columns for compliance_documents with joined type name. */
const COMPLIANCE_DOCS_SELECT =
  "id, profile_id, document_type_id, reference_number, issue_date, expiry_date, status, file_name, file_path, notes, verified_at, compliance_document_types(name)";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab = params.tab || "overview";

  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile) {
    redirect("/login");
  }

  // Fetch all profile data in parallel
  const [
    { data: employeeDetails },
    { data: emergencyContacts },
    { data: employmentHistory },
    { data: rawDocs },
  ] = await Promise.all([
    supabase
      .from("employee_details")
      .select(EMPLOYEE_DETAILS_SELECT)
      .eq("profile_id", user.id)
      .single(),
    supabase
      .from("emergency_contacts")
      .select(EMERGENCY_CONTACTS_SELECT)
      .eq("profile_id", user.id)
      .order("sort_order"),
    supabase
      .from("employment_history")
      .select(EMPLOYMENT_HISTORY_SELECT)
      .eq("profile_id", user.id)
      .order("effective_date", { ascending: false }),
    supabase
      .from("compliance_documents")
      .select(COMPLIANCE_DOCS_SELECT)
      .eq("profile_id", user.id)
      .order("expiry_date"),
  ]);

  // Flatten the joined type name for the component
  const complianceDocuments = (rawDocs ?? []).map((doc) => {
    const docType = doc.compliance_document_types as unknown as { name: string } | null;
    return {
      id: doc.id as string,
      document_type_name: docType?.name ?? "Unknown",
      status: doc.status as ComplianceStatus,
      issue_date: doc.issue_date as string | null,
      expiry_date: doc.expiry_date as string | null,
      reference_number: doc.reference_number as string | null,
      file_name: doc.file_name as string | null,
      file_path: doc.file_path as string | null,
      notes: doc.notes as string | null,
      verified_at: doc.verified_at as string | null,
    };
  });

  // Build profile object with the fields the component needs
  const profileData = {
    full_name: profile.full_name,
    preferred_name: profile.preferred_name ?? null,
    email: profile.email,
    avatar_url: profile.avatar_url ?? null,
    job_title: profile.job_title ?? null,
    department: profile.department ?? null,
    region: profile.region ?? null,
    fte: profile.fte ?? 1,
    contract_type: profile.contract_type ?? null,
    work_pattern: profile.work_pattern ?? null,
    start_date: profile.start_date ?? null,
    is_external: profile.is_external ?? false,
    is_hr_admin: profile.is_hr_admin ?? false,
    is_ld_admin: profile.is_ld_admin ?? false,
    is_line_manager: profile.is_line_manager ?? false,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-1">
          View and update your personal information
        </p>
      </div>
      <ProfilePageContent
        profile={profileData}
        employeeDetails={employeeDetails ?? null}
        emergencyContacts={emergencyContacts ?? []}
        employmentHistory={employmentHistory ?? []}
        complianceDocuments={complianceDocuments}
        activeTab={activeTab}
      />
    </div>
  );
}
