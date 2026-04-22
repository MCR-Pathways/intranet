"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DestructiveMenuItem } from "@/components/ui/destructive-menu-item";
import { MoreHorizontal } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
import { COMPLIANCE_STATUS_CONFIG, formatHRDate } from "@/lib/hr";
import type { ComplianceStatus } from "@/lib/hr";
import {
  verifyComplianceDocument,
  deleteComplianceDocument,
  getComplianceDocumentUrl,
} from "@/app/(protected)/hr/compliance/actions";
import { ComplianceUploadDialog } from "./compliance-upload-dialog";
import { ComplianceEditDialog } from "./compliance-edit-dialog";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  Download,
} from "lucide-react";
import { toast } from "sonner";

interface ComplianceDocumentRow {
  id: string;
  document_type_name: string;
  status: ComplianceStatus;
  issue_date: string | null;
  expiry_date: string | null;
  reference_number: string | null;
  file_name: string | null;
  file_path: string | null;
  notes: string | null;
  verified_at: string | null;
}

interface DocumentType {
  id: string;
  name: string;
}

interface ProfileDocumentsTabProps {
  profileId?: string;
  profileName?: string;
  complianceDocuments: ComplianceDocumentRow[];
  documentTypes?: DocumentType[];
  isHRAdmin?: boolean;
}

/** Status indicator dot + label. */
function StatusBadge({ status }: { status: ComplianceStatus }) {
  const config = COMPLIANCE_STATUS_CONFIG[status] ?? COMPLIANCE_STATUS_CONFIG.not_applicable;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${config.dotColour}`} />
      <span className={`text-xs font-medium ${config.colour}`}>{config.label}</span>
    </div>
  );
}

export function ProfileDocumentsTab({
  profileId,
  profileName,
  complianceDocuments,
  documentTypes = [],
  isHRAdmin = false,
}: ProfileDocumentsTabProps) {
  const [isPending, startTransition] = useTransition();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ComplianceDocumentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ComplianceDocumentRow | null>(null);

  const handleVerify = useCallback((docId: string) => {
    startTransition(async () => {
      const result = await verifyComplianceDocument(docId);
      if (result.success) {
        toast.success("Document verified");
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
      }
    });
  }, [startTransition]);

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteComplianceDocument(deleteTarget.id);
      if (result.success) {
        toast.success("Document deleted");
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
      }
      setDeleteTarget(null);
    });
  };

  const handleDownload = useCallback((filePath: string) => {
    startTransition(async () => {
      const result = await getComplianceDocumentUrl(filePath);
      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        toast.error(result.error || "Failed to download document");
      }
    });
  }, [startTransition]);

  // Columns depend on isHRAdmin + handlers, so memoised inside the component
  const columns = useMemo<ColumnDef<ComplianceDocumentRow>[]>(() => {
    const base: ColumnDef<ComplianceDocumentRow>[] = [
      {
        accessorKey: "document_type_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Document" />
        ),
        cell: ({ row }) => {
          const doc = row.original;
          return (
            <div>
              <p className="font-medium">{doc.document_type_name}</p>
              {doc.file_name && (
                <p className="text-xs text-muted-foreground">{doc.file_name}</p>
              )}
              {doc.reference_number && (
                <p className="text-xs text-muted-foreground">
                  Ref: {doc.reference_number}
                </p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        enableSorting: false,
      },
      {
        accessorKey: "expiry_date",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Expiry Date" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {formatHRDate(row.original.expiry_date)}
          </span>
        ),
      },
      {
        accessorKey: "verified_at",
        header: "Verified",
        cell: ({ row }) =>
          row.original.verified_at ? (
            <Badge variant="success" className="text-xs">
              Verified
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
        enableSorting: false,
      },
    ];

    if (isHRAdmin) {
      base.push({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const doc = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={isPending}
                  aria-label={`Actions for ${doc.document_type_name}`}
                  title="Actions"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {doc.file_path && (
                  <DropdownMenuItem
                    onSelect={() => handleDownload(doc.file_path!)}
                    disabled={isPending}
                  >
                    <Download />
                    Download
                  </DropdownMenuItem>
                )}
                {!doc.verified_at && (
                  <DropdownMenuItem
                    onSelect={() => handleVerify(doc.id)}
                    disabled={isPending}
                  >
                    <CheckCircle />
                    Verify
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() => setEditingDoc(doc)}
                  disabled={isPending}
                >
                  <Pencil />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DestructiveMenuItem
                  onSelect={() => setDeleteTarget(doc)}
                  disabled={isPending}
                >
                  <Trash2 />
                  Delete
                </DestructiveMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
      });
    }

    return base;
  }, [isHRAdmin, isPending, handleVerify, handleDownload]);

  if (complianceDocuments.length === 0 && !isHRAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">
            No compliance documents recorded yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Compliance Documents</CardTitle>
          {isHRAdmin && profileId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Upload Document
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {complianceDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <FileText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No compliance documents recorded yet.
              </p>
            </div>
          ) : (
            <>
              <DataTable
                columns={columns}
                data={complianceDocuments}
                emptyMessage="No compliance documents recorded yet."
              />
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  Valid
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  Expiring Soon
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                  Expired
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      {isHRAdmin && profileId && profileName && (
        <ComplianceUploadDialog
          profileId={profileId}
          profileName={profileName}
          documentTypes={documentTypes}
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
        />
      )}

      {/* Edit Dialog */}
      {editingDoc && (
        <ComplianceEditDialog
          document={editingDoc}
          open={!!editingDoc}
          onOpenChange={(open) => {
            if (!open) setEditingDoc(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the{" "}
              <strong>{deleteTarget?.document_type_name}</strong> document?
              {deleteTarget?.file_name && (
                <>
                  {" "}The associated file ({deleteTarget.file_name}) will also be
                  permanently removed.
                </>
              )}
              {" "}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete Document"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
