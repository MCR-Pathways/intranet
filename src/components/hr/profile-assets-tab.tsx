"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { AssetReturnDialog } from "@/components/hr/asset-return-dialog";
import { formatHRDate } from "@/lib/hr";
import { RotateCcw, Package } from "lucide-react";

interface AssetAssignmentRow {
  id: string;
  asset_id: string;
  asset_tag: string;
  asset_type_name: string;
  make: string | null;
  model: string | null;
  assigned_date: string;
  returned_date: string | null;
  condition_on_assignment: string | null;
  condition_on_return: string | null;
}

interface Employee {
  id: string;
  full_name: string;
}

interface AssetType {
  id: string;
  name: string;
}

interface ProfileAssetsTabProps {
  profileId: string;
  profileName: string;
  assignments: AssetAssignmentRow[];
  availableAssets?: { id: string; asset_tag: string }[];
  employees?: Employee[];
  assetTypes?: AssetType[];
  isHRAdmin?: boolean;
}

const historyColumns: ColumnDef<AssetAssignmentRow>[] = [
  {
    accessorKey: "asset_tag",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Asset" />
    ),
    cell: ({ row }) => (
      <div>
        <span className="font-mono text-xs">{row.original.asset_tag}</span>
        <span className="text-muted-foreground ml-2">
          {[row.original.make, row.original.model].filter(Boolean).join(" ")}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "assigned_date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Assigned" />
    ),
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatHRDate(row.original.assigned_date)}
      </span>
    ),
  },
  {
    accessorKey: "returned_date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Returned" />
    ),
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatHRDate(row.original.returned_date)}
      </span>
    ),
  },
  {
    accessorKey: "condition_on_return",
    header: "Condition",
    cell: ({ row }) => row.original.condition_on_return ?? "—",
    enableSorting: false,
  },
];

export function ProfileAssetsTab({
  profileName,
  assignments,
  isHRAdmin = false,
}: ProfileAssetsTabProps) {
  const [returnTarget, setReturnTarget] = useState<AssetAssignmentRow | null>(null);

  const current = assignments.filter((a) => !a.returned_date);
  const history = assignments.filter((a) => !!a.returned_date);

  return (
    <div className="space-y-6">
      {/* Current assignments */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Current Assets ({current.length})</h3>
        {current.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Package className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No assets currently assigned</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {current.map((a) => (
              <Card key={a.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{a.asset_type_name}</CardTitle>
                  <Badge variant="secondary">{a.asset_tag}</Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{[a.make, a.model].filter(Boolean).join(" ") || "—"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assigned {formatHRDate(a.assigned_date)}
                    {a.condition_on_assignment && <> · {a.condition_on_assignment}</>}
                  </p>
                  {isHRAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setReturnTarget(a)}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Return
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Assignment History</h3>
          <DataTable
            columns={historyColumns}
            data={history}
            emptyMessage="No assignment history"
          />
        </div>
      )}

      {/* Return dialog */}
      {returnTarget && (
        <AssetReturnDialog
          assignmentId={returnTarget.id}
          assetTag={returnTarget.asset_tag}
          employeeName={profileName}
          open={!!returnTarget}
          onOpenChange={(val) => { if (!val) setReturnTarget(null); }}
        />
      )}
    </div>
  );
}
