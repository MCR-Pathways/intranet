"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, AlertTriangle, Clock } from "lucide-react";
import { FWR_STATUS_CONFIG, FWR_REQUEST_TYPE_CONFIG, formatHRDate } from "@/lib/hr";
import type { FWRStatus, FWRRequestType } from "@/lib/hr";
import type { FlexibleWorkingRequestWithEmployee } from "@/types/hr";
import { FlexibleWorkingRequestDialog } from "./flexible-working-request-dialog";
import { cn } from "@/lib/utils";

interface FlexibleWorkingDashboardProps {
  requests: FlexibleWorkingRequestWithEmployee[];
  currentUserId: string;
  isHRAdmin: boolean;
  isManager: boolean;
  activeTab: string;
  eligible: boolean;
  requestsInLast12Months: number;
  hasLiveRequest: boolean;
}

export function FlexibleWorkingDashboard({
  requests,
  currentUserId,
  isHRAdmin,
  isManager,
  activeTab,
  eligible,
  requestsInLast12Months,
  hasLiveRequest,
}: FlexibleWorkingDashboardProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Split requests by role
  const myRequests = useMemo(
    () => requests.filter((r) => r.profile_id === currentUserId),
    [requests, currentUserId],
  );

  const teamRequests = useMemo(
    () => requests.filter((r) => r.manager_id === currentUserId && r.profile_id !== currentUserId),
    [requests, currentUserId],
  );

  // Apply filters to the currently visible list
  const filterRequests = (list: FlexibleWorkingRequestWithEmployee[]) => {
    return list.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.request_type !== typeFilter) return false;
      return true;
    });
  };

  const handleTabChange = (tab: string) => {
    router.push(`/hr/flexible-working?tab=${tab}`, { scroll: false });
  };

  const deadlineWarning = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return "overdue";
    if (daysLeft <= 14) return "warning";
    return "ok";
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(FWR_STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(FWR_REQUEST_TYPE_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="button" onClick={() => setDialogOpen(true)} disabled={!eligible}>
          <Plus className="mr-2 h-4 w-4" />
          New Request
        </Button>
      </div>

      {!eligible && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
            <div className="text-sm text-amber-800">
              {hasLiveRequest
                ? "You have an active request being processed. You can submit a new request once it's resolved."
                : `You've made ${requestsInLast12Months} of 2 allowed requests in the last 12 months.`}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs key={activeTab} defaultValue={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="my-requests">
            My Requests
            {myRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {myRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          {(isManager || isHRAdmin) && (
            <TabsTrigger value="team-requests">
              Team Requests
              {teamRequests.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {teamRequests.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {isHRAdmin && (
            <TabsTrigger value="all-requests">
              All Requests
              <Badge variant="secondary" className="ml-2">
                {requests.length}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my-requests">
          <RequestTable
            requests={filterRequests(myRequests)}
            showEmployee={false}
            deadlineWarning={deadlineWarning}
          />
        </TabsContent>

        {(isManager || isHRAdmin) && (
          <TabsContent value="team-requests">
            <RequestTable
              requests={filterRequests(teamRequests)}
              showEmployee
              deadlineWarning={deadlineWarning}
            />
          </TabsContent>
        )}

        {isHRAdmin && (
          <TabsContent value="all-requests">
            <RequestTable
              requests={filterRequests(requests)}
              showEmployee
              deadlineWarning={deadlineWarning}
            />
          </TabsContent>
        )}
      </Tabs>

      <FlexibleWorkingRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        requestsInLast12Months={requestsInLast12Months}
      />
    </>
  );
}

// =============================================
// REQUEST TABLE
// =============================================

function RequestTable({
  requests,
  showEmployee,
  deadlineWarning,
}: {
  requests: FlexibleWorkingRequestWithEmployee[];
  showEmployee: boolean;
  deadlineWarning: (deadline: string) => "overdue" | "warning" | "ok";
}) {
  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No flexible working requests found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {showEmployee && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>}
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Submitted</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Deadline</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Start Date</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => {
            const statusConfig = FWR_STATUS_CONFIG[request.status as FWRStatus];
            const typeConfig = FWR_REQUEST_TYPE_CONFIG[request.request_type as FWRRequestType];
            const warning = deadlineWarning(request.response_deadline);
            const isActive = ["submitted", "under_review"].includes(request.status);

            return (
              <tr key={request.id} className="border-b last:border-0">
                {showEmployee && (
                  <td className="px-4 py-3">
                    <Link
                      href={`/hr/flexible-working/${request.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {request.employee_name}
                    </Link>
                    {request.employee_job_title && (
                      <div className="text-xs text-muted-foreground">
                        {request.employee_job_title}
                      </div>
                    )}
                  </td>
                )}
                <td className="px-4 py-3">
                  {!showEmployee ? (
                    <Link
                      href={`/hr/flexible-working/${request.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {typeConfig?.label ?? request.request_type}
                    </Link>
                  ) : (
                    <span>{typeConfig?.label ?? request.request_type}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {statusConfig && (
                    <Badge
                      variant="outline"
                      className={cn(statusConfig.colour, statusConfig.bgColour, "border-0")}
                    >
                      {statusConfig.label}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatHRDate(request.created_at)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      isActive && warning === "overdue" && "font-semibold text-red-600",
                      isActive && warning === "warning" && "font-medium text-amber-600",
                      !isActive && "text-muted-foreground",
                    )}
                  >
                    {formatHRDate(request.response_deadline)}
                    {isActive && warning === "overdue" && (
                      <Clock className="ml-1 inline h-3.5 w-3.5" />
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatHRDate(request.proposed_start_date)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
