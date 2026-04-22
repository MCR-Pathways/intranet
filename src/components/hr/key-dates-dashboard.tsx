"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { createRowNumberColumn } from "@/components/ui/data-table-row-number";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DestructiveMenuItem } from "@/components/ui/destructive-menu-item";
import { KeyDateDialog } from "@/components/hr/key-date-dialog";
import { completeKeyDate, deleteKeyDate } from "@/app/(protected)/hr/key-dates/actions";
import { formatHRDate } from "@/lib/hr";
import { Plus, Search, Check, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface KeyDateRow {
  id: string;
  profile_id: string;
  date_type: string;
  due_date: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  employee_name: string;
}

interface Employee {
  id: string;
  full_name: string;
}

interface KeyDatesDashboardProps {
  keyDates: KeyDateRow[];
  employees: Employee[];
}

const TYPE_LABELS: Record<string, string> = {
  probation_end: "Probation End",
  appraisal_due: "Appraisal Due",
  contract_end: "Contract End",
  course_renewal: "Course Renewal",
  custom: "Custom",
};

export function KeyDatesDashboard({ keyDates, employees }: KeyDatesDashboardProps) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<KeyDateRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KeyDateRow | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    return keyDates.filter((kd) => {
      if (!showCompleted && kd.is_completed) return false;
      if (typeFilter !== "all" && kd.date_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!kd.employee_name.toLowerCase().includes(q) && !kd.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [keyDates, showCompleted, typeFilter, search]);

  const handleComplete = useCallback((id: string) => {
    startTransition(async () => {
      const result = await completeKeyDate(id);
      if (result.success) {
        toast.success("Key date completed");
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
      }
    });
  }, [startTransition]);

  const handleDelete = useCallback((id: string) => {
    startTransition(async () => {
      const result = await deleteKeyDate(id);
      if (result.success) {
        toast.success("Key date deleted");
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
      }
    });
  }, [startTransition]);

  const columns = useMemo<ColumnDef<KeyDateRow>[]>(() => [
    createRowNumberColumn<KeyDateRow>(),
    {
      accessorKey: "employee_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Employee" />
      ),
      cell: ({ row }) => (
        <Link href={`/hr/users/${row.original.profile_id}?tab=overview`} className="hover:underline text-primary">
          {row.original.employee_name}
        </Link>
      ),
    },
    {
      accessorKey: "date_type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline">{TYPE_LABELS[row.original.date_type] ?? row.original.date_type}</Badge>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
    },
    {
      accessorKey: "due_date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Due Date" />
      ),
      cell: ({ row }) => (
        <span className={`whitespace-nowrap ${!row.original.is_completed && row.original.due_date < today ? "text-destructive font-medium" : ""}`}>
          {formatHRDate(row.original.due_date)}
        </span>
      ),
    },
    {
      id: "priority",
      accessorFn: (row) => {
        if (row.is_completed) return 2;
        return row.due_date < today ? 0 : 1;
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Priority" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        if (item.is_completed) {
          return <Badge variant="outline" className="text-xs">Completed</Badge>;
        }
        if (item.due_date < today) {
          return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
        }
        return <Badge className="text-xs">Upcoming</Badge>;
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const kd = row.original;
        return (
          <AlertDialog
            open={deleteTarget?.id === kd.id}
            onOpenChange={(open) => !open && setDeleteTarget(null)}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={isPending}
                  aria-label={`Actions for ${kd.title}`}
                  title="Actions"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!kd.is_completed && (
                  <DropdownMenuItem
                    onSelect={() => handleComplete(kd.id)}
                    disabled={isPending}
                  >
                    <Check />
                    Mark complete
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setEditTarget(kd)}>
                  <Pencil />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DestructiveMenuItem
                  onSelect={() => setDeleteTarget(kd)}
                >
                  <Trash2 />
                  Delete
                </DestructiveMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete key date?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this key date.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isPending}
                  aria-busy={isPending}
                  onClick={() => handleDelete(kd.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      },
      enableSorting: false,
    },
  ], [today, isPending, handleComplete, handleDelete, deleteTarget?.id]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-[200px]" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={showCompleted ? "secondary" : "outline"} size="sm" onClick={() => setShowCompleted(!showCompleted)}>
          {showCompleted ? "Hide Completed" : "Show Completed"}
        </Button>
        <Button onClick={() => setCreateOpen(true)} className="ml-auto">
          <Plus className="h-4 w-4 mr-1" /> Add Key Date
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage="No key dates found"
        initialSorting={[{ id: "priority", desc: false }]}
      />

      {/* Dialogs */}
      <KeyDateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        employees={employees}
      />
      {editTarget && (
        <KeyDateDialog
          open={!!editTarget}
          onOpenChange={(val) => { if (!val) setEditTarget(null); }}
          profileId={editTarget.profile_id}
          profileName={editTarget.employee_name}
          existing={editTarget}
        />
      )}
    </div>
  );
}
