"use client";

import { useState, useTransition, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
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
import { MAX_MEDIUM_TEXT_LENGTH } from "@/lib/validation";
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

// =============================================
// TYPES
// =============================================

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

// =============================================
// ROW ACTIONS
// =============================================

function LeaveRowActions({
  request,
  currentUserId,
  isHRAdmin,
  isManager,
  isPending,
  onWithdraw,
  onApprove,
  onReject,
  onCancel,
}: {
  request: AnyLeaveRequest;
  currentUserId: string;
  isHRAdmin: boolean;
  isManager: boolean;
  isPending: boolean;
  onWithdraw: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const isOwn = request.profile_id === currentUserId;
  const canWithdraw = isOwn && request.status === "pending";
  const canDecide = request.status === "pending" && (isManager || isHRAdmin) && !isOwn;
  const canCancel = isHRAdmin && request.status === "approved";

  if (!canWithdraw && !canDecide && !canCancel) return null;

  return (
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
              <AlertDialogAction onClick={() => onWithdraw(request.id)}>
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
            onClick={() => onApprove(request.id)}
          >
            Approve
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={() => onReject(request.id)}
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
              <AlertDialogAction onClick={() => onCancel(request.id)}>
                Cancel Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// =============================================
// COMPONENT
// =============================================

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

  const columns = useMemo<ColumnDef<AnyLeaveRequest>[]>(() => [
    {
      accessorKey: "employee_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Employee" />
      ),
      cell: ({ row }) => (
        <span>{(row.original as LeaveRequestWithEmployee).employee_name ?? "—"}</span>
      ),
    },
    {
      accessorKey: "leave_type",
      header: "Type",
      cell: ({ row }) => {
        const config = LEAVE_TYPE_CONFIG[row.original.leave_type as LeaveType];
        return (
          <Badge variant={config?.badgeVariant ?? "outline"}>
            {config?.label ?? row.original.leave_type}
          </Badge>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "start_date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Dates" />
      ),
      cell: ({ row }) => {
        const request = row.original;
        const overlapping = overlapMap.get(request.id) ?? [];
        const teammateIds = teamMemberMap?.[request.profile_id] ?? [];
        const teamSize = teammateIds.length + 1;
        const availableCount = teamSize - overlapping.length - 1;

        return (
          <div>
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
          </div>
        );
      },
    },
    {
      accessorKey: "total_days",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Days" />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatLeaveDays(row.original.total_days)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const request = row.original;
        return (
          <div>
            <Badge variant={STATUS_BADGE_VARIANT[request.status] ?? "outline"}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </Badge>
            {request.rejection_reason && (
              <p className="text-xs text-muted-foreground mt-1">
                {request.rejection_reason}
              </p>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <LeaveRowActions
          request={row.original}
          currentUserId={currentUserId}
          isHRAdmin={isHRAdmin}
          isManager={isManager}
          isPending={isPending}
          onWithdraw={handleWithdraw}
          onApprove={(id) => setApproveTarget(id)}
          onReject={(id) => {
            setRejectTarget(id);
            setRejectDialogOpen(true);
          }}
          onCancel={handleCancel}
        />
      ),
      enableSorting: false,
    },
  ], [overlapMap, teamMemberMap, currentUserId, isHRAdmin, isManager, isPending]);

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
      <DataTable
        columns={columns}
        data={filteredRequests}
        emptyMessage="No leave requests found"
        initialSorting={[{ id: "start_date", desc: true }]}
        initialColumnVisibility={{ employee_name: showEmployee }}
      />

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
              maxLength={MAX_MEDIUM_TEXT_LENGTH}
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
