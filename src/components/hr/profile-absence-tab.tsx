"use client";

import { useState, useMemo, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RecordAbsenceDialog } from "./record-absence-dialog";
import { ReturnToWorkForm } from "./return-to-work-form";
import {
  ABSENCE_TYPE_CONFIG,
  SICKNESS_CATEGORY_CONFIG,
  RTW_STATUS_CONFIG,
  formatHRDate,
  formatLeaveDays,
  getWellbeingPrompt,
  calculateTriggerPoint,
} from "@/lib/hr";
import type {
  AbsenceRecord,
  ReturnToWorkForm as RTWFormType,
  RTWStatus,
} from "@/types/hr";
import { deleteAbsence } from "@/app/(protected)/hr/absence/actions";
import {
  Plus,
  MoreHorizontal,
  Trash2,
  ClipboardCheck,
  Eye,
  AlertTriangle,
  Info,
  Stethoscope,
} from "lucide-react";

// =============================================
// TYPES
// =============================================

interface AbsenceRecordRow extends AbsenceRecord {
  rtw_status: RTWStatus | null;
  rtw_form_id: string | null;
}

interface ProfileAbsenceTabProps {
  profileId: string;
  profileName: string;
  absenceRecords: AbsenceRecordRow[];
  /** Pre-fetched RTW forms keyed by absence_record_id */
  rtwForms: Record<string, RTWFormType>;
  publicHolidays: string[];
  currentUserId: string;
  isHRAdmin: boolean;
  isManager: boolean;
}

// =============================================
// COMPONENT
// =============================================

export function ProfileAbsenceTab({
  profileId,
  profileName,
  absenceRecords,
  rtwForms,
  publicHolidays,
  currentUserId,
  isHRAdmin,
  isManager,
}: ProfileAbsenceTabProps) {
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [rtwTarget, setRtwTarget] = useState<AbsenceRecordRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AbsenceRecordRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Wellbeing prompt — HR admin only, computed from sick absences in last 12 months
  const wellbeingPrompt = useMemo(() => {
    if (!isHRAdmin || absenceRecords.length === 0) return null;
    const today = new Date().toISOString().slice(0, 10);
    const triggerResult = calculateTriggerPoint(absenceRecords, today);
    return getWellbeingPrompt(triggerResult.spells, triggerResult.days);
  }, [isHRAdmin, absenceRecords]);

  function handleDelete() {
    if (!deleteTarget) return;
    setError(null);

    startTransition(async () => {
      const result = await deleteAbsence(deleteTarget.id);
      if (result.success) {
        setDeleteTarget(null);
      } else {
        setError(result.error);
      }
    });
  }

  // Columns depend on isManager/isHRAdmin + state setters
  const columns = useMemo<ColumnDef<AbsenceRecordRow>[]>(() => [
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
              <Badge variant="warning" className="text-xs">
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
        const rtwStatus = row.original.rtw_status;
        const rtwConfig = rtwStatus ? RTW_STATUS_CONFIG[rtwStatus] : null;
        return rtwConfig ? (
          <Badge variant={rtwConfig.badgeVariant}>
            {rtwConfig.label}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      enableSorting: false,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const record = row.original;
        const rtwStatus = record.rtw_status;
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* View/Complete RTW — managers and HR */}
                {(isManager || isHRAdmin) && (
                  <DropdownMenuItem onSelect={() => setRtwTarget(record)}>
                    {record.rtw_form_id ? (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        View RTW Form
                      </>
                    ) : (
                      <>
                        <ClipboardCheck className="h-4 w-4 mr-2" />
                        Complete RTW
                      </>
                    )}
                  </DropdownMenuItem>
                )}

                {/* Employee can view RTW if submitted/locked */}
                {!isManager && !isHRAdmin && rtwStatus && rtwStatus !== "draft" && (
                  <DropdownMenuItem onSelect={() => setRtwTarget(record)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View RTW Form
                  </DropdownMenuItem>
                )}

                {/* Delete — HR admin only */}
                {isHRAdmin && (
                  <DropdownMenuItem
                    onSelect={() => setDeleteTarget(record)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
    },
  ], [isManager, isHRAdmin]);

  return (
    <div className="space-y-6">
      {/* Header with action button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Absence Records ({absenceRecords.length})
        </h3>
        {isHRAdmin && (
          <Button onClick={() => setRecordDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Record Absence
          </Button>
        )}
      </div>

      {/* Wellbeing prompt card — HR admin only */}
      {wellbeingPrompt && (
        <Card
          className={
            wellbeingPrompt.severity === "high"
              ? "border-amber-200 bg-amber-50"
              : wellbeingPrompt.severity === "medium"
                ? "border-yellow-200 bg-yellow-50"
                : "border-blue-200 bg-blue-50"
          }
        >
          <CardContent className="flex items-start gap-3 py-4">
            {wellbeingPrompt.severity === "high" ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium">
                {wellbeingPrompt.severity === "high"
                  ? "Attendance Concern"
                  : wellbeingPrompt.severity === "medium"
                    ? "Wellbeing Check-In"
                    : "Absence Note"}
              </p>
              <p className="text-sm mt-1">{wellbeingPrompt.prompt}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Absence records table */}
      <DataTable
        columns={columns}
        data={absenceRecords}
        emptyMessage="No absence records"
        initialSorting={[{ id: "start_date", desc: true }]}
      />

      {/* Record Absence Dialog */}
      <RecordAbsenceDialog
        profileId={profileId}
        profileName={profileName}
        publicHolidays={publicHolidays}
        open={recordDialogOpen}
        onOpenChange={setRecordDialogOpen}
      />

      {/* RTW Form Sheet */}
      {rtwTarget && (
        <ReturnToWorkForm
          absenceRecord={rtwTarget}
          employeeName={profileName}
          existingForm={rtwForms[rtwTarget.id] ?? null}
          currentUserId={currentUserId}
          isHRAdmin={isHRAdmin}
          isManager={isManager}
          open={!!rtwTarget}
          onOpenChange={(val) => { if (!val) setRtwTarget(null); }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(val) => { if (!val) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Absence Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the absence record
              {deleteTarget && ` (${formatHRDate(deleteTarget.start_date)} – ${formatHRDate(deleteTarget.end_date)})`}
              {deleteTarget?.rtw_form_id && " and its associated return-to-work form"}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
