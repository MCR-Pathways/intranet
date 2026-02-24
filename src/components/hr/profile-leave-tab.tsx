"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LeaveBalanceCards } from "@/components/hr/leave-balance-cards";
import { LeaveRequestTable } from "@/components/hr/leave-request-table";
import { LeaveEntitlementDialog } from "@/components/hr/leave-entitlement-dialog";
import { RecordLeaveDialog } from "@/components/hr/record-leave-dialog";
import type { LeaveBalance, LeaveRequest } from "@/types/hr";
import { Plus, FileText } from "lucide-react";

interface ProfileLeaveTabProps {
  profileId: string;
  profileName: string;
  fte: number;
  startDate: string | null;
  currentUserId: string;
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  publicHolidays: string[];
  isHRAdmin?: boolean;
}

export function ProfileLeaveTab({
  profileId,
  profileName,
  fte,
  startDate,
  currentUserId,
  balances,
  requests,
  publicHolidays,
  isHRAdmin = false,
}: ProfileLeaveTabProps) {
  const [entitlementOpen, setEntitlementOpen] = useState(false);
  const [recordLeaveOpen, setRecordLeaveOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* HR Admin actions */}
      {isHRAdmin && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEntitlementOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Set Entitlement
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRecordLeaveOpen(true)}>
            <FileText className="h-4 w-4 mr-1" />
            Record Leave
          </Button>
        </div>
      )}

      {/* Balances */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Leave Balances</h3>
        <LeaveBalanceCards balances={balances} />
      </div>

      {/* Request history */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Leave History</h3>
        <LeaveRequestTable
          requests={requests}
          currentUserId={currentUserId}
          isHRAdmin={isHRAdmin}
        />
      </div>

      {/* HR Admin dialogs */}
      {isHRAdmin && (
        <>
          <LeaveEntitlementDialog
            profileId={profileId}
            profileName={profileName}
            fte={fte}
            startDate={startDate}
            open={entitlementOpen}
            onOpenChange={setEntitlementOpen}
          />
          <RecordLeaveDialog
            profileId={profileId}
            profileName={profileName}
            publicHolidays={publicHolidays}
            open={recordLeaveOpen}
            onOpenChange={setRecordLeaveOpen}
          />
        </>
      )}
    </div>
  );
}
