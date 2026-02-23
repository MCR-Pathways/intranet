"use client";

import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileOverviewTab } from "./profile-overview-tab";
import { ProfileEmploymentTab } from "./profile-employment-tab";
import { ProfileDocumentsTab } from "./profile-documents-tab";
import { ProfileLeaveTab } from "./profile-leave-tab";
import { ProfileAssetsTab } from "./profile-assets-tab";
import { ProfileKeyDatesSection } from "./profile-key-dates-section";
import { EmploymentEditDialog } from "./employment-edit-dialog";
import { PersonalDetailsEditDialog } from "./personal-details-edit-dialog";
import {
  GENDER_CONFIG,
  formatHRDate,
} from "@/lib/hr";
import type { ComplianceStatus } from "@/lib/hr";
import type {
  EmployeeProfile,
  EmployeeDetails,
  EmergencyContact,
  EmploymentHistoryEntry,
  LeaveBalance,
  LeaveRequest,
} from "@/types/hr";
import { Pencil, Phone, Mail, User } from "lucide-react";

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

interface DocumentType {
  id: string;
  name: string;
}

interface AssetAssignmentRow {
  id: string;
  asset_id: string;
  asset_tag: string;
  asset_type_name: string;
  make: string | null;
  model: string | null;
  assigned_date: string;
  returned_date: string | null;
  condition_on_assignment: string | null;
  condition_on_return: string | null;
}

interface KeyDateRow {
  id: string;
  profile_id: string;
  date_type: string;
  due_date: string;
  title: string;
  description: string | null;
  is_completed: boolean;
}

interface EmployeeDetailContentProps {
  profile: EmployeeProfile;
  employeeDetails: EmployeeDetails | null;
  emergencyContacts: EmergencyContact[];
  employmentHistory: EmploymentHistoryEntry[];
  complianceDocuments: ComplianceDocumentRow[];
  complianceDocumentTypes?: DocumentType[];
  isHRAdmin?: boolean;
  currentUserId: string;
  lineManagerName: string | null;
  teamName: string | null;
  activeTab: string;
  leaveBalances?: LeaveBalance[];
  leaveRequests?: LeaveRequest[];
  publicHolidays?: string[];
  assetAssignments?: AssetAssignmentRow[];
  keyDates?: KeyDateRow[];
}

const VALID_TABS = ["overview", "personal", "employment", "documents", "leave", "assets"];

export function EmployeeDetailContent({
  profile,
  employeeDetails,
  emergencyContacts,
  employmentHistory,
  complianceDocuments,
  complianceDocumentTypes = [],
  isHRAdmin = false,
  currentUserId,
  lineManagerName,
  teamName,
  activeTab,
  leaveBalances = [],
  leaveRequests = [],
  publicHolidays = [],
  assetAssignments = [],
  keyDates = [],
}: EmployeeDetailContentProps) {
  const tab = VALID_TABS.includes(activeTab) ? activeTab : "overview";

  const [employmentDialogOpen, setEmploymentDialogOpen] = useState(false);
  const [personalDialogOpen, setPersonalDialogOpen] = useState(false);

  return (
    <>
      <Tabs key={tab} defaultValue={tab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEmploymentDialogOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit Employment
            </Button>
          </div>
          <ProfileOverviewTab
            profile={profile}
            lineManagerName={lineManagerName}
            teamName={teamName}
          />
          <ProfileKeyDatesSection
            profileId={profile.id}
            profileName={profile.full_name}
            keyDates={keyDates}
            isHRAdmin={isHRAdmin}
          />
        </TabsContent>

        <TabsContent value="personal" className="mt-6 space-y-6">
          {/* HR admin personal details view (read-only + edit button) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Personal Details</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPersonalDialogOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Date of Birth" value={formatHRDate(employeeDetails?.date_of_birth ?? null)} />
                <DetailField label="NI Number" value={employeeDetails?.ni_number ?? "—"} />
                <DetailField
                  label="Gender"
                  value={
                    employeeDetails?.gender && employeeDetails.gender in GENDER_CONFIG
                      ? GENDER_CONFIG[employeeDetails.gender as keyof typeof GENDER_CONFIG].label
                      : "—"
                  }
                />
                <DetailField label="Pronouns" value={employeeDetails?.pronouns ?? "—"} />
                <DetailField label="Nationality" value={employeeDetails?.nationality ?? "—"} />
                <DetailField label="Personal Email" value={employeeDetails?.personal_email ?? "—"} />
                <DetailField label="Personal Phone" value={employeeDetails?.personal_phone ?? "—"} />
                <DetailField
                  label="Address"
                  value={
                    [
                      employeeDetails?.address_line_1,
                      employeeDetails?.address_line_2,
                      employeeDetails?.city,
                      employeeDetails?.postcode,
                      employeeDetails?.country,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contacts (read-only for HR admin) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Emergency Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              {emergencyContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No emergency contacts recorded.
                </p>
              ) : (
                <div className="space-y-4">
                  {emergencyContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="rounded-lg border p-4 space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium text-sm">{contact.full_name}</p>
                        <span className="text-xs text-muted-foreground">
                          ({contact.relationship})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {contact.phone_primary}
                        {contact.phone_secondary && (
                          <span className="text-xs">/ {contact.phone_secondary}</span>
                        )}
                      </div>
                      {contact.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          {contact.email}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment" className="mt-6">
          <ProfileEmploymentTab employmentHistory={employmentHistory} />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <ProfileDocumentsTab
            profileId={profile.id}
            profileName={profile.full_name}
            complianceDocuments={complianceDocuments}
            documentTypes={complianceDocumentTypes}
            isHRAdmin={isHRAdmin}
          />
        </TabsContent>

        <TabsContent value="leave" className="mt-6">
          <ProfileLeaveTab
            profileId={profile.id}
            profileName={profile.full_name}
            fte={profile.fte}
            currentUserId={currentUserId}
            balances={leaveBalances}
            requests={leaveRequests}
            publicHolidays={publicHolidays}
            isHRAdmin={isHRAdmin}
          />
        </TabsContent>

        <TabsContent value="assets" className="mt-6">
          <ProfileAssetsTab
            profileId={profile.id}
            profileName={profile.full_name}
            assignments={assetAssignments}
            isHRAdmin={isHRAdmin}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Dialogs */}
      <EmploymentEditDialog
        profile={profile}
        open={employmentDialogOpen}
        onOpenChange={setEmploymentDialogOpen}
      />
      <PersonalDetailsEditDialog
        userId={profile.id}
        employeeDetails={employeeDetails}
        open={personalDialogOpen}
        onOpenChange={setPersonalDialogOpen}
      />
    </>
  );
}

/** Simple read-only field display. */
function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}
