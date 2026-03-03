"use client";

import { useState, useTransition, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LEAVE_TYPE_CONFIG, formatHRDate, formatLeaveDays } from "@/lib/hr";
import type { LeaveType } from "@/lib/hr";
import type { LeaveRequest, LeaveRequestWithEmployee } from "@/types/hr";
import {
  withdrawLeave,
  approveLeave,
  rejectLeave,
  cancelLeave,
} from "@/app/(protected)/hr/leave/actions";
import { Search, Undo2, Users } from "lucide-react";
import { toast } from "sonner";

type AnyLeaveRequest = LeaveRequest | LeaveRequestWithEmployee;

interface LeaveRequestTableProps {
  requests: AnyLeaveRequest[];
  currentUserId: string;
  isHRAdmin?: boolean;
  isManager?: boolean;
  showEmployee?: boolean;
  allRequests?: LeaveRequestWithEmployee[];
  teamMemberMap?: Record<string, string[]>;
}

/** Find approved leave from teammates that overlaps the given request's dates. */
function getTeamOverlap(
  request: AnyLeaveRequest,
  allRequests: LeaveRequestWithEmployee[],
  teamMemberMap: Record<string, string[]>,
): LeaveRequestWithEmployee[] {
  const teammateIds = teamMemberMap[request.profile_id];
  if (!teammateIds?.length) return [];

  return allRequests.filter(
    (r) =>
      teammateIds.includes(r.profile_id) &&
      r.status === "approved" &&
      r.start_date <= request.end_date &&
      r.end_date >= request.start_date &&
      r.id !== request.id,
  );
}

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "outline",
  withdrawn: "outline",
};

export function LeaveRequestTable({
  requests,
  currentUserId,
  isHRAdmin = false,
  isManager = false,
  showEmployee = false,
  allRequests,
  teamMemberMap,
}: LeaveRequestTableProps) {
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [approveTarget, setApproveTarget] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.leave_type !== typeFilter) return false;
      if (search && showEmployee) {
        const req = r as LeaveRequestWithEmployee;
        const q = search.toLowerCase();
        if (!req.employee_name?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, typeFilter, search, showEmployee]);

  // Pre-compute team overlap for all filtered requests to avoid O(n*m) per render
  const overlapMap = useMemo(() => {
    if (!allRequests || !teamMemberMap) return new Map<string, LeaveRequestWithEmployee[]>();
    const map = new Map<string, LeaveRequestWithEmployee[]>();
    for (const request of filteredRequests) {
      map.set(request.id, getTeamOverlap(request, allRequests, teamMemberMap));
    }
    return map;
  }, [filteredRequests, allRequests, teamMemberMap]);

  function handleWithdraw(requestId: string) {
    startTransition(async () => {
      const result = await withdrawLeave(requestId);
      if (result.success) {
        toast.success("Leave withdrawn");
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
      }
    });
  }

  function handleApprove() {
    if (!approveTarget) return;
    startTransition(async () => {
      const result = await approveLeave(approveTarget);
      if (result.success) {
        toast.success("Leave approved");
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
      }
      setApproveTarget(null);
    });
  }

  function handleReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    startTransition(async () => {
      const result = await rejectLeave(rejectTarget, rejectReason.trim());
      if (result.success) {
        toast.success("Leave rejected");
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
      }
      setRejectDialogOpen(false);
      setRejectTarget(null);
      setRejectReason("");
    });
  }

  function handleCancel(requestId: string) {
    startTransition(async () => {
      const result = await cancelLeave(requestId);
      if (result.success) {
        toast.success("Leave cancelled");
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {showEmployee && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-[200px]"
            />
          </div>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="withdrawn">Withdrawn</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(LEAVE_TYPE_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {showEmployee && (
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Employee
                </th>
              )}
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Dates</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Days</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td
                  colSpan={showEmployee ? 6 : 5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No leave requests found
                </td>
              </tr>
            ) : (
              filteredRequests.map((request) => {
                const config = LEAVE_TYPE_CONFIG[request.leave_type as LeaveType];
                const isOwn = request.profile_id === currentUserId;
                const canWithdraw = isOwn && request.status === "pending";
                const canDecide =
                  request.status === "pending" && (isManager || isHRAdmin) && !isOwn;
                const canCancel = isHRAdmin && request.status === "approved";

                // Team overlap detection (approver view only)
                const overlapping = overlapMap.get(request.id) ?? [];
                const teammateIds = teamMemberMap?.[request.profile_id] ?? [];
                const teamSize = teammateIds.length + 1; // teammates + the requester
                const availableCount = teamSize - overlapping.length - 1; // minus overlapping and the requester

                return (
                  <tr key={request.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    {showEmployee && (
                      <td className="px-4 py-3">
                        {(request as LeaveRequestWithEmployee).employee_name ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Badge variant={config?.badgeVariant ?? "outline"}>
                        {config?.label ?? request.leave_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="whitespace-nowrap">
                        {formatHRDate(request.start_date)}
                        {request.start_date !== request.end_date && (
                          <> – {formatHRDate(request.end_date)}</>
                        )}
                        {request.start_half_day && (
                          <span className="text-xs text-muted-foreground ml-1">(PM)</span>
                        )}
                        {request.end_half_day && (
                          <span className="text-xs text-muted-foreground ml-1">(AM)</span>
                        )}
                      </div>
                      {overlapping.length > 0 && (
                        <div className="mt-1.5 rounded-md bg-blue-50 px-2 py-1.5 text-xs text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                          <Users className="inline h-3 w-3 mr-1 -mt-0.5" />
                          {overlapping.map((r) => r.employee_name).join(", ")}
                          {overlapping.length === 1 ? " is" : " are"} also on leave during this period.
                          {teamSize > 1 && (
                            <span className="ml-1">
                              Team: {availableCount}/{teamSize} available.
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatLeaveDays(request.total_days)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE_VARIANT[request.status] ?? "outline"}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </Badge>
                      {request.rejection_reason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {request.rejection_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {canWithdraw && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" disabled={isPending}>
                                <Undo2 className="h-3.5 w-3.5 mr-1" />
                                Withdraw
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Withdraw leave request?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will withdraw your pending leave request. You can submit a new one if needed.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep Request</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleWithdraw(request.id)}>
                                  Withdraw
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {canDecide && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              disabled={isPending}
                              onClick={() => setApproveTarget(request.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={isPending}
                              onClick={() => {
                                setRejectTarget(request.id);
                                setRejectDialogOpen(true);
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {canCancel && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" disabled={isPending}>
                                Cancel
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel approved leave?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will cancel the approved leave request. The days will be returned to the employee&apos;s balance.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleCancel(request.id)}>
                                  Cancel Leave
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filteredRequests.length} of {requests.length} requests
      </p>

      {/* Approve confirmation dialog */}
      <AlertDialog
        open={!!approveTarget}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve leave request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will approve the leave request and deduct the days from the employee&apos;s balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={isPending}>
              {isPending ? "Approving..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject reason dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this request.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="reject-reason">Reason *</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isPending || !rejectReason.trim()}
            >
              {isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
