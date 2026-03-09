"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AssetDialog } from "@/components/hr/asset-dialog";
import { AssetAssignDialog } from "@/components/hr/asset-assign-dialog";
import { AssetReturnDialog } from "@/components/hr/asset-return-dialog";
import { retireAsset } from "@/app/(protected)/hr/assets/actions";
import { Plus, Search, Package, Pencil, UserPlus, RotateCcw, Archive } from "lucide-react";
import { toast } from "sonner";

interface AssetType {
  id: string;
  name: string;
}

interface AssetRow {
  id: string;
  asset_type_id: string;
  asset_type_name: string;
  asset_tag: string;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  warranty_expiry_date: string | null;
  status: string;
  notes: string | null;
  current_assignee: string | null;
  current_assignee_id: string | null;
  current_assignment_id: string | null;
}

interface Employee {
  id: string;
  full_name: string;
}

interface AssetPageContentProps {
  assets: AssetRow[];
  assetTypes: AssetType[];
  employees: Employee[];
  isHRAdmin: boolean;
  summary: { total: number; assigned: number; available: number; in_repair: number };
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  assigned: "secondary",
  in_repair: "outline",
  retired: "outline",
  lost: "destructive",
};

export function AssetPageContent({
  assets, assetTypes, employees, isHRAdmin, summary,
}: AssetPageContentProps) {
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<AssetRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<AssetRow | null>(null);
  const [returnTarget, setReturnTarget] = useState<AssetRow | null>(null);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (typeFilter !== "all" && a.asset_type_id !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !a.asset_tag.toLowerCase().includes(q) &&
          !a.make?.toLowerCase().includes(q) &&
          !a.model?.toLowerCase().includes(q) &&
          !a.serial_number?.toLowerCase().includes(q) &&
          !a.current_assignee?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [assets, statusFilter, typeFilter, search]);

  const handleRetire = useCallback((assetId: string) => {
    startTransition(async () => {
      const result = await retireAsset(assetId);
      if (result.success) {
        toast.success("Asset retired");
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
      }
    });
  }, [startTransition]);

  const columns = useMemo<ColumnDef<AssetRow>[]>(() => {
    const cols: ColumnDef<AssetRow>[] = [
      createRowNumberColumn<AssetRow>(),
      {
        accessorKey: "asset_tag",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Tag" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.asset_tag}</span>
        ),
      },
      {
        accessorKey: "asset_type_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Type" />
        ),
      },
      {
        id: "make_model",
        accessorFn: (row) => [row.make, row.model].filter(Boolean).join(" ") || null,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Make / Model" />
        ),
        cell: ({ getValue }) => (
          <span>{getValue<string>() || "—"}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={STATUS_BADGE[row.original.status] ?? "outline"}>
            {row.original.status === "in_repair"
              ? "In Repair"
              : row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)}
          </Badge>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "current_assignee",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Assigned To" />
        ),
        cell: ({ row }) => (
          <span>{row.original.current_assignee ?? "—"}</span>
        ),
      },
    ];

    if (isHRAdmin) {
      cols.push({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const asset = row.original;
          return (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditAsset(asset)} title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {asset.status === "available" && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAssignTarget(asset)} title="Assign">
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              )}
              {asset.status === "assigned" && asset.current_assignment_id && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReturnTarget(asset)} title="Return">
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
              {(asset.status === "available" || asset.status === "in_repair") && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Retire">
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Retire asset {asset.asset_tag}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will mark the asset as retired. It will no longer be available for assignment.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleRetire(asset.id)}>Retire</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          );
        },
        enableSorting: false,
      });
    }

    return cols;
  }, [isHRAdmin, handleRetire]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      {isHRAdmin && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{summary.total}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Assigned</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-blue-600">{summary.assigned}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Available</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-600">{summary.available}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">In Repair</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-amber-600">{summary.in_repair}</div></CardContent>
          </Card>
        </div>
      )}

      {/* Filters + Add */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search assets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-[220px]" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_repair">In Repair</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {assetTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {isHRAdmin && (
          <Button onClick={() => setCreateOpen(true)} className="ml-auto">
            <Plus className="h-4 w-4 mr-1" /> Add Asset
          </Button>
        )}
      </div>

      {/* Table */}
      <DataTable columns={columns} data={filtered} emptyMessage="No assets found" />

      {/* Dialogs */}
      <AssetDialog assetTypes={assetTypes} open={createOpen} onOpenChange={setCreateOpen} />
      {editAsset && (
        <AssetDialog
          assetTypes={assetTypes}
          open={!!editAsset}
          onOpenChange={(val) => { if (!val) setEditAsset(null); }}
          existing={editAsset}
        />
      )}
      {assignTarget && (
        <AssetAssignDialog
          assetId={assignTarget.id}
          assetTag={assignTarget.asset_tag}
          employees={employees}
          open={!!assignTarget}
          onOpenChange={(val) => { if (!val) setAssignTarget(null); }}
        />
      )}
      {returnTarget && returnTarget.current_assignment_id && (
        <AssetReturnDialog
          assignmentId={returnTarget.current_assignment_id}
          assetTag={returnTarget.asset_tag}
          employeeName={returnTarget.current_assignee ?? "Unknown"}
          open={!!returnTarget}
          onOpenChange={(val) => { if (!val) setReturnTarget(null); }}
        />
      )}
    </div>
  );
}
