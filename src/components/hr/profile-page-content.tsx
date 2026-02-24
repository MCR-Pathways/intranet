"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ProfileOverviewTab } from "./profile-overview-tab";
import { ProfilePersonalTab } from "./profile-personal-tab";
import { ProfileEmploymentTab } from "./profile-employment-tab";
import { ProfileDocumentsTab } from "./profile-documents-tab";
import type { EmployeeDetails, EmergencyContact, EmploymentHistoryEntry } from "@/types/hr";
import type { ComplianceStatus, ContractType, Department, Region, WorkPattern } from "@/lib/hr";

interface ComplianceDocumentRow {
  id: string;
  document_type_name: string;
  status: ComplianceStatus;
  issue_date: string | null;
  expiry_date: string | null;
  reference_number: string | null;
  file_name: string | null;
  file_path: string | null;
  notes: string | null;
  verified_at: string | null;
}

interface ProfilePageContentProps {
  profile: {
    full_name: string;
    preferred_name: string | null;
    email: string;
    avatar_url: string | null;
    job_title: string | null;
    department: Department | null;
    region: Region | null;
    fte: number;
    contract_type: ContractType | null;
    work_pattern: WorkPattern | null;
    start_date: string | null;
    is_external: boolean;
    is_hr_admin: boolean;
    is_ld_admin: boolean;
    is_line_manager: boolean;
  };
  employeeDetails: EmployeeDetails | null;
  emergencyContacts: EmergencyContact[];
  employmentHistory: EmploymentHistoryEntry[];
  complianceDocuments: ComplianceDocumentRow[];
  activeTab: string;
}

const VALID_TABS = ["overview", "personal", "employment", "documents"];

export function ProfilePageContent({
  profile,
  employeeDetails,
  emergencyContacts,
  employmentHistory,
  complianceDocuments,
  activeTab,
}: ProfilePageContentProps) {
  const tab = VALID_TABS.includes(activeTab) ? activeTab : "overview";

  return (
    <Tabs key={tab} defaultValue={tab} className="w-full">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="personal">Personal</TabsTrigger>
        <TabsTrigger value="employment">Employment</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-6">
        <ProfileOverviewTab profile={profile} />
      </TabsContent>

      <TabsContent value="personal" className="mt-6">
        <ProfilePersonalTab
          employeeDetails={employeeDetails}
          emergencyContacts={emergencyContacts}
        />
      </TabsContent>

      <TabsContent value="employment" className="mt-6">
        <ProfileEmploymentTab employmentHistory={employmentHistory} />
      </TabsContent>

      <TabsContent value="documents" className="mt-6">
        <ProfileDocumentsTab complianceDocuments={complianceDocuments} />
      </TabsContent>
    </Tabs>
  );
}
