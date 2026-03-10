"use client";

import { useState, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { createRowNumberColumn } from "@/components/ui/data-table-row-number";
import {
  LEAVING_STATUS_CONFIG,
  LEAVING_REASON_CONFIG,
  formatHRDate,
} from "@/lib/hr";
import type { StaffLeavingFormWithEmployee } from "@/types/hr";
import { CreateLeavingFormDialog } from "./create-leaving-form-dialog";
import { Plus, Search } from "lucide-react";
import Link from "next/link";

// =============================================
// TYPES
// =============================================

interface LeavingFormRow extends StaffLeavingFormWithEmployee {
  initiator_name: string | null;
}

interface Employee {
  id: string;
  full_name: string;
  job_title: string | null;
}

interface LeavingDashboardContentProps {
  leavingForms: LeavingFormRow[];
  activeEmployees: Employee[];
  activeTab: string;
}

// =============================================
// COMPONENT
// =============================================

export function LeavingDashboardContent({
  leavingForms,
  activeEmployees,
  activeTab,
}: LeavingDashboardContentProps) {
  const tab = ["active", "completed", "all"].includes(activeTab) ? activeTab : "active";
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const activeForms = useMemo(
    () => leavingForms.filter((f) => ["draft", "submitted", "in_progress"].includes(f.status)),
    [leavingForms],
  );

  const completedForms = useMemo(
    () => leavingForms.filter((f) => f.status === "completed"),
    [leavingForms],
  );

  const allForms = useMemo(
    () => leavingForms.filter((f) => f.status !== "cancelled"),
    [leavingForms],
  );

  // Multi-field search — kept external per lesson: "keep multi-field search external to DataTable"
  function filterBySearch<T extends { employee_name: string; reason_for_leaving: string }>(
    forms: T[],
  ): T[] {
    if (!searchTerm.trim()) return forms;
    const term = searchTerm.toLowerCase();
    return forms.filter(
      (f) =>
        f.employee_name.toLowerCase().includes(term) ||
        LEAVING_REASON_CONFIG[f.reason_for_leaving as keyof typeof LEAVING_REASON_CONFIG]?.label
          .toLowerCase()
          .includes(term),
    );
  }

  const columns = useMemo<ColumnDef<LeavingFormRow>[]>(() => [
    createRowNumberColumn<LeavingFormRow>(),
    {
      accessorKey: "employee_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Employee" />
      ),
      cell: ({ row }) => {
        const form = row.original;
        return (
          <div>
            <p className="font-medium">{form.employee_name}</p>
            {form.employee_job_title && (
              <p className="text-xs text-muted-foreground">{form.employee_job_title}</p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "leaving_date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Leaving Date" />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{formatHRDate(row.original.leaving_date)}</span>
      ),
    },
    {
      accessorKey: "reason_for_leaving",
      header: "Reason",
      cell: ({ row }) => {
        const reasonConfig = LEAVING_REASON_CONFIG[row.original.reason_for_leaving as keyof typeof LEAVING_REASON_CONFIG];
        return <span>{reasonConfig?.label ?? row.original.reason_for_leaving}</span>;
      },
      enableSorting: false,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const statusConfig = LEAVING_STATUS_CONFIG[row.original.status];
        return (
          <Badge variant="outline" className={`${statusConfig.colour} ${statusConfig.bgColour} border-0`}>
            {statusConfig.label}
          </Badge>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "initiator_name",
      header: "Initiated By",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.initiator_name ?? "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="text-right">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/hr/leaving/${row.original.id}`}>View</Link>
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ], []);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Leaving Form
        </Button>
      </div>

      <Tabs key={tab} defaultValue={tab} className="w-full">
        <TabsList>
          <TabsTrigger value="active">
            Active ({activeForms.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedForms.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({allForms.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <DataTable
            columns={columns}
            data={filterBySearch(activeForms)}
            emptyMessage="No active leaving forms"
            initialSorting={[{ id: "leaving_date", desc: false }]}
          />
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <DataTable
            columns={columns}
            data={filterBySearch(completedForms)}
            emptyMessage="No completed leaving forms"
            initialSorting={[{ id: "leaving_date", desc: false }]}
          />
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <DataTable
            columns={columns}
            data={filterBySearch(allForms)}
            emptyMessage="No leaving forms"
            initialSorting={[{ id: "leaving_date", desc: false }]}
          />
        </TabsContent>
      </Tabs>

      <CreateLeavingFormDialog
        employees={activeEmployees}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
