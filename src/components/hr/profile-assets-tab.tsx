"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Asset</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Assigned</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Returned</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Condition</th>
                </tr>
              </thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs">{a.asset_tag}</span>
                      <span className="text-muted-foreground ml-2">
                        {[a.make, a.model].filter(Boolean).join(" ")}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatHRDate(a.assigned_date)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatHRDate(a.returned_date)}</td>
                    <td className="px-4 py-2">
                      {a.condition_on_return ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
