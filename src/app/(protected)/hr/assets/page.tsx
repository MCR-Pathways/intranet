import { getCurrentUser, isHRAdminEffective } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AssetPageContent } from "@/components/hr/asset-page-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatHRDate } from "@/lib/hr";
import { Package } from "lucide-react";

/** Select columns for assets joined with type name. */
const ASSET_SELECT =
  "id, asset_type_id, asset_tag, make, model, serial_number, purchase_date, purchase_cost, warranty_expiry_date, status, notes, asset_types(name)";

/** Select columns for active assignments with employee name. */
const ASSIGNMENT_SELECT =
  "id, asset_id, profile_id, assigned_date, returned_date, condition_on_assignment, profiles!profile_id(full_name)";

export default async function AssetsPage() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) {
    redirect("/login");
  }

  const isHRAdmin = isHRAdminEffective(profile);

  if (isHRAdmin) {
    // HR admin: full asset catalogue
    const [
      { data: rawAssets },
      { data: assetTypes },
      { data: rawAssignments },
      { data: employees },
    ] = await Promise.all([
      supabase.from("assets").select(ASSET_SELECT).order("asset_tag"),
      supabase.from("asset_types").select("id, name").eq("is_active", true).order("name"),
      supabase
        .from("asset_assignments")
        .select(ASSIGNMENT_SELECT)
        .is("returned_date", null),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("status", "active")
        .order("full_name"),
    ]);

    // Build assignment lookup: asset_id → { assignee name, assignment id }
    const assignmentMap = new Map<string, { name: string; id: string; profileId: string }>();
    (rawAssignments ?? []).forEach((a) => {
      const p = a.profiles as unknown as { full_name: string } | null;
      assignmentMap.set(a.asset_id as string, {
        name: p?.full_name ?? "Unknown",
        id: a.id as string,
        profileId: a.profile_id as string,
      });
    });

    const assets = (rawAssets ?? []).map((a) => {
      const typeName = (a.asset_types as unknown as { name: string } | null)?.name ?? "Unknown";
      const assignment = assignmentMap.get(a.id as string);
      return {
        id: a.id as string,
        asset_type_id: a.asset_type_id as string,
        asset_type_name: typeName,
        asset_tag: a.asset_tag as string,
        make: a.make as string | null,
        model: a.model as string | null,
        serial_number: a.serial_number as string | null,
        purchase_date: a.purchase_date as string | null,
        purchase_cost: a.purchase_cost as number | null,
        warranty_expiry_date: a.warranty_expiry_date as string | null,
        status: a.status as string,
        notes: a.notes as string | null,
        current_assignee: assignment?.name ?? null,
        current_assignee_id: assignment?.profileId ?? null,
        current_assignment_id: assignment?.id ?? null,
      };
    });

    const types = (assetTypes ?? []).map((t) => ({
      id: t.id as string,
      name: t.name as string,
    }));

    const employeeList = (employees ?? []).map((e) => ({
      id: e.id as string,
      full_name: e.full_name as string,
    }));

    const summary = {
      total: assets.length,
      assigned: assets.filter((a) => a.status === "assigned").length,
      available: assets.filter((a) => a.status === "available").length,
      in_repair: assets.filter((a) => a.status === "in_repair").length,
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
          <p className="text-muted-foreground mt-1">
            Manage company assets and assignments
          </p>
        </div>
        <AssetPageContent
          assets={assets}
          assetTypes={types}
          employees={employeeList}
          isHRAdmin
          summary={summary}
        />
      </div>
    );
  }

  // Regular employee: show my assets
  const { data: myAssignments } = await supabase
    .from("asset_assignments")
    .select("id, asset_id, assigned_date, condition_on_assignment, notes, assets(asset_tag, make, model, status, asset_types(name))")
    .eq("profile_id", user.id)
    .is("returned_date", null)
    .order("assigned_date", { ascending: false });

  const myAssets = (myAssignments ?? []).map((a) => {
    const asset = a.assets as unknown as {
      asset_tag: string; make: string | null; model: string | null;
      status: string; asset_types: { name: string } | null;
    } | null;
    return {
      id: a.id as string,
      asset_tag: asset?.asset_tag ?? "Unknown",
      type_name: asset?.asset_types?.name ?? "Unknown",
      make: asset?.make ?? null,
      model: asset?.model ?? null,
      assigned_date: a.assigned_date as string,
      condition: a.condition_on_assignment as string | null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Assets</h1>
        <p className="text-muted-foreground mt-1">
          Company equipment assigned to you
        </p>
      </div>

      {myAssets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No assets currently assigned to you</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {myAssets.map((asset) => (
            <Card key={asset.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{asset.type_name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-xs text-muted-foreground mb-1">{asset.asset_tag}</p>
                <p className="text-sm font-medium">
                  {[asset.make, asset.model].filter(Boolean).join(" ") || "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Assigned {formatHRDate(asset.assigned_date)}
                  {asset.condition && <> · Condition: {asset.condition}</>}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
