"use client";

import { Clock } from "lucide-react";
import { LEAVE_TYPE_CONFIG } from "@/lib/hr";
import type { LeaveType } from "@/lib/hr";
import { formatShortDate } from "@/lib/utils";

interface PendingLeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
}

interface PendingLeaveListProps {
  requests: PendingLeaveRequest[];
}

export function PendingLeaveList({ requests }: PendingLeaveListProps) {
  if (requests.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Pending Leave Requests
      </h3>
      <div className="space-y-2">
        {requests.map((req) => {
          const config = LEAVE_TYPE_CONFIG[req.leave_type as LeaveType];
          const startDate = new Date(req.start_date + "T00:00:00");
          const endDate = new Date(req.end_date + "T00:00:00");
          const isSingleDay = req.start_date === req.end_date;

          const dateRange = isSingleDay
            ? formatShortDate(startDate)
            : `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;

          return (
            <div
              key={req.id}
              className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2"
            >
              <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${config?.colour ?? "text-gray-700"}`}>
                  {config?.label ?? req.leave_type}
                </span>
                <span className="text-sm text-muted-foreground ml-2">
                  {dateRange}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">
                  {req.total_days} {req.total_days === 1 ? "day" : "days"}
                </span>
                <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                  Pending
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
