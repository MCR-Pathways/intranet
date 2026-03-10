"use client";

import { useState, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { createRowNumberColumn } from "@/components/ui/data-table-row-number";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ABSENCE_TYPE_CONFIG,
  SICKNESS_CATEGORY_CONFIG,
  RTW_STATUS_CONFIG,
  formatHRDate,
  formatLeaveDays,
} from "@/lib/hr";
import type { RTWStatus } from "@/types/hr";
import Link from "next/link";
import { Search, ExternalLink } from "lucide-react";

// =============================================
// TYPES
// =============================================

interface AbsenceRow {
  id: string;
  profile_id: string;
  absence_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  is_long_term: boolean;
  sickness_category: string | null;
  reason: string | null;
  employee_name: string;
  rtw_status: RTWStatus | null;
  rtw_form_id: string | null;
}

interface PendingRTWRow {
  id: string;
  absence_record_id: string;
  employee_id: string;
  employee_name: string;
  absence_start_date: string;
  absence_end_date: string;
  status: RTWStatus;
  completed_at: string;
  completed_by_name: string | null;
}

interface AbsenceDashboardContentProps {
  absenceRecords: AbsenceRow[];
  pendingRTWForms: PendingRTWRow[];
  activeTab: string;
}

// =============================================
// COMPONENT
// =============================================

export function AbsenceDashboardContent({
  absenceRecords,
  pendingRTWForms,
  activeTab,
}: AbsenceDashboardContentProps) {
  const tab = ["all", "pending-rtw"].includes(activeTab) ? activeTab : "all";

  // Filters for All Absences tab
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filteredRecords = useMemo(() => {
    return absenceRecords.filter((r) => {
      if (search && !r.employee_name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (typeFilter !== "all" && r.absence_type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [absenceRecords, search, typeFilter]);

  // Columns for All Absences tab — Category folded into Type as subtitle
  const absenceColumns = useMemo<ColumnDef<AbsenceRow>[]>(() => [
    createRowNumberColumn<AbsenceRow>(),
    {
      accessorKey: "employee_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Employee" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/hr/users/${row.original.profile_id}?tab=absence`}
          className="text-primary hover:underline font-medium"
        >
          {row.original.employee_name}
        </Link>
      ),
    },
    {
      accessorKey: "start_date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Dates" />
      ),
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span>
              {formatHRDate(record.start_date)} – {formatHRDate(record.end_date)}
            </span>
            {record.is_long_term && (
              <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">
                Long-term
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "absence_type",
      header: "Type",
      cell: ({ row }) => {
        const record = row.original;
        const typeConfig = ABSENCE_TYPE_CONFIG[record.absence_type as keyof typeof ABSENCE_TYPE_CONFIG];
        const categoryConfig = record.sickness_category
          ? SICKNESS_CATEGORY_CONFIG[record.sickness_category as keyof typeof SICKNESS_CATEGORY_CONFIG]
          : null;
        return (
          <div>
            {typeConfig ? (
              <Badge className={`${typeConfig.bgColour} ${typeConfig.colour} border-0`}>
                {typeConfig.label}
              </Badge>
            ) : (
              <span>{record.absence_type}</span>
            )}
            {categoryConfig && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {categoryConfig.label}
              </p>
            )}
          </div>
        );
      },
      enableSorting: false,
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
      accessorKey: "rtw_status",
      header: "RTW",
      cell: ({ row }) => {
        const rtwConfig = row.original.rtw_status ? RTW_STATUS_CONFIG[row.original.rtw_status] : null;
        return rtwConfig ? (
          <Badge className={`${rtwConfig.bgColour} ${rtwConfig.colour} border-0`}>
            {rtwConfig.label}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      enableSorting: false,
    },
    {
      id: "view",
      header: () => <span className="sr-only">View</span>,
      cell: ({ row }) => (
        <div className="text-right">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/hr/users/${row.original.profile_id}?tab=absence`}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ], []);

  // Columns for Pending RTW tab
  const rtwColumns = useMemo<ColumnDef<PendingRTWRow>[]>(() => [
    createRowNumberColumn<PendingRTWRow>(),
    {
      accessorKey: "employee_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Employee" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/hr/users/${row.original.employee_id}?tab=absence`}
          className="text-primary hover:underline font-medium"
        >
          {row.original.employee_name}
        </Link>
      ),
    },
    {
      accessorKey: "absence_start_date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Absence Period" />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatHRDate(row.original.absence_start_date)} – {formatHRDate(row.original.absence_end_date)}
        </span>
      ),
    },
    {
      accessorKey: "completed_by_name",
      header: "Completed By",
      cell: ({ row }) => (
        <span>{row.original.completed_by_name ?? "—"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const statusConfig = RTW_STATUS_CONFIG[row.original.status];
        return (
          <Badge className={`${statusConfig.bgColour} ${statusConfig.colour} border-0`}>
            {statusConfig.label}
          </Badge>
        );
      },
      enableSorting: false,
    },
    {
      id: "view",
      header: () => <span className="sr-only">View</span>,
      cell: ({ row }) => (
        <div className="text-right">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/hr/users/${row.original.employee_id}?tab=absence`}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ], []);

  return (
    <Tabs key={tab} defaultValue={tab} className="w-full">
      <TabsList>
        <TabsTrigger value="all">
          All Absences ({absenceRecords.length})
        </TabsTrigger>
        <TabsTrigger value="pending-rtw">
          Pending RTW ({pendingRTWForms.length})
        </TabsTrigger>
      </TabsList>

      {/* All Absences Tab */}
      <TabsContent value="all" className="mt-6 space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by employee name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(ABSENCE_TYPE_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={absenceColumns}
          data={filteredRecords}
          emptyMessage={absenceRecords.length === 0 ? "No absence records" : "No records match your filters"}
          initialSorting={[{ id: "start_date", desc: true }]}
        />
      </TabsContent>

      {/* Pending RTW Tab */}
      <TabsContent value="pending-rtw" className="mt-6">
        <DataTable
          columns={rtwColumns}
          data={pendingRTWForms}
          emptyMessage="No pending return-to-work forms"
          initialSorting={[{ id: "absence_start_date", desc: true }]}
        />
      </TabsContent>
    </Tabs>
  );
}
