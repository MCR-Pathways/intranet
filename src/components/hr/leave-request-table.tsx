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
import { Search, Undo2 } from "lucide-react";

type AnyLeaveRequest = LeaveRequest | LeaveRequestWithEmployee;

interface LeaveRequestTableProps {
  requests: AnyLeaveRequest[];
  currentUserId: string;
  isHRAdmin?: boolean;
  isManager?: boolean;
  showEmployee?: boolean;
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
}: LeaveRequestTableProps) {
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
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

  function handleWithdraw(requestId: string) {
    startTransition(async () => {
      await withdrawLeave(requestId);
    });
  }

  function handleApprove(requestId: string) {
    startTransition(async () => {
      await approveLeave(requestId);
    });
  }

  function handleReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    startTransition(async () => {
      await rejectLeave(rejectTarget, rejectReason.trim());
      setRejectDialogOpen(false);
      setRejectTarget(null);
      setRejectReason("");
    });
  }

  function handleCancel(requestId: string) {
    startTransition(async () => {
      await cancelLeave(requestId);
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
                    <td className="px-4 py-3 whitespace-nowrap">
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
                              onClick={() => handleApprove(request.id)}
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
