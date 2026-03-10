"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LeaveBalanceCards } from "@/components/hr/leave-balance-cards";
import { LeaveRequestTable } from "@/components/hr/leave-request-table";
import { LeaveRequestDialog } from "@/components/hr/leave-request-dialog";
import { PeopleCalendar } from "@/components/shared/people-calendar";
import type { LeaveBalance, LeaveRequest, LeaveRequestWithEmployee } from "@/types/hr";
import { Plus } from "lucide-react";

interface LeaveDashboardContentProps {
  profile: {
    id: string;
    full_name: string;
    region: string | null;
    fte: number;
    is_line_manager: boolean;
    is_hr_admin: boolean;
  };
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  pendingApprovals: LeaveRequestWithEmployee[];
  allRequests: LeaveRequestWithEmployee[];
  publicHolidays: { holiday_date: string; name: string }[];
  activeTab: string;
  teamMemberMap?: Record<string, string[]>;
}

export function LeaveDashboardContent({
  profile,
  balances,
  requests,
  pendingApprovals,
  allRequests,
  publicHolidays,
  activeTab,
  teamMemberMap,
}: LeaveDashboardContentProps) {
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

  const showApprovals = profile.is_line_manager || profile.is_hr_admin;
  const showAdmin = profile.is_hr_admin;

  // Build valid tabs based on role
  const validTabs = ["my-leave"];
  if (showApprovals) validTabs.push("approvals", "calendar");
  if (showAdmin) validTabs.push("admin");
  const tab = validTabs.includes(activeTab) ? activeTab : "my-leave";
  const holidayDates = publicHolidays.map((h) => h.holiday_date);

  return (
    <>
      <Tabs key={tab} defaultValue={tab}>
        <div className="flex items-center justify-between">
          <TabsList variant="line">
            <TabsTrigger value="my-leave">My Leave</TabsTrigger>
            {showApprovals && (
              <TabsTrigger value="approvals">
                Approvals
                {pendingApprovals.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] text-destructive-foreground">
                    {pendingApprovals.length}
                  </span>
                )}
              </TabsTrigger>
            )}
            {showApprovals && <TabsTrigger value="calendar">Team Calendar</TabsTrigger>}
            {showAdmin && <TabsTrigger value="admin">All Requests</TabsTrigger>}
          </TabsList>

          <Button onClick={() => setRequestDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Request Leave
          </Button>
        </div>

        <TabsContent value="my-leave" className="mt-6 space-y-6">
          <LeaveBalanceCards balances={balances} />
          <div>
            <h3 className="text-lg font-semibold mb-4">My Requests</h3>
            <LeaveRequestTable
              requests={requests}
              currentUserId={profile.id}
              isHRAdmin={profile.is_hr_admin}
            />
          </div>
        </TabsContent>

        {showApprovals && (
          <TabsContent value="approvals" className="mt-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">
                Pending Approvals ({pendingApprovals.length})
              </h3>
              <LeaveRequestTable
                requests={pendingApprovals}
                currentUserId={profile.id}
                isHRAdmin={profile.is_hr_admin}
                isManager={profile.is_line_manager}
                showEmployee
                allRequests={allRequests}
                teamMemberMap={teamMemberMap}
              />
            </div>
          </TabsContent>
        )}

        {showApprovals && (
          <TabsContent value="calendar" className="mt-6">
            <PeopleCalendar
              leaveRequests={allRequests}
              publicHolidays={publicHolidays}
              showEmployee
              mode="team"
            />
          </TabsContent>
        )}

        {showAdmin && (
          <TabsContent value="admin" className="mt-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">All Leave Requests</h3>
              <LeaveRequestTable
                requests={allRequests}
                currentUserId={profile.id}
                isHRAdmin
                showEmployee
              />
            </div>
          </TabsContent>
        )}
      </Tabs>

      <LeaveRequestDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        publicHolidays={holidayDates}
      />
    </>
  );
}
