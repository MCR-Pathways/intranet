"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LEAVING_STATUS_CONFIG,
  LEAVING_REASON_CONFIG,
  formatHRDate,
} from "@/lib/hr";
import type { StaffLeavingForm } from "@/types/hr";
import { CreateLeavingFormDialog } from "./create-leaving-form-dialog";
import { UserX, ExternalLink } from "lucide-react";
import Link from "next/link";

interface ProfileLeavingTabProps {
  profileId: string;
  profileName: string;
  leavingForm: StaffLeavingForm | null;
  isHRAdmin: boolean;
  isManager: boolean;
}

export function ProfileLeavingTab({
  profileId,
  profileName,
  leavingForm,
  isHRAdmin,
  isManager,
}: ProfileLeavingTabProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  if (!leavingForm) {
    return (
      <>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <UserX className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground mb-4">No leaving form for this employee.</p>
            {(isHRAdmin || isManager) && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                Start Leaving Process
              </Button>
            )}
          </CardContent>
        </Card>

        <CreateLeavingFormDialog
          employee={{ id: profileId, full_name: profileName, job_title: null }}
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </>
    );
  }

  const statusConfig = LEAVING_STATUS_CONFIG[leavingForm.status];
  const reasonConfig = LEAVING_REASON_CONFIG[leavingForm.reason_for_leaving];

  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={statusConfig.badgeVariant}>
                {statusConfig.label}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">Leaving Date</p>
                <p className="font-medium">{formatHRDate(leavingForm.leaving_date)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Reason</p>
                <p className="font-medium">{reasonConfig?.label ?? leavingForm.reason_for_leaving}</p>
              </div>
              {leavingForm.last_working_date && (
                <div>
                  <p className="text-muted-foreground">Last Working Date</p>
                  <p className="font-medium">{formatHRDate(leavingForm.last_working_date)}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Last Updated</p>
                <p className="font-medium">{formatHRDate(leavingForm.updated_at)}</p>
              </div>
            </div>
          </div>

          <Button variant="outline" size="sm" asChild>
            <Link href={`/hr/leaving/${leavingForm.id}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View Full Form
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
