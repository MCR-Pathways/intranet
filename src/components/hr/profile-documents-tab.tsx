"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  const handleVerify = (docId: string) => {
    startTransition(async () => {
      await verifyComplianceDocument(docId);
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      await deleteComplianceDocument(deleteTarget.id);
      setDeleteTarget(null);
    });
  };

  const handleDownload = (filePath: string) => {
    startTransition(async () => {
      const result = await getComplianceDocumentUrl(filePath);
      if (result.success && result.url) {
        window.location.href = result.url;
      }
    });
  };

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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Document</th>
                      <th className="pb-2 font-medium text-muted-foreground">Status</th>
                      <th className="pb-2 font-medium text-muted-foreground">Issue Date</th>
                      <th className="pb-2 font-medium text-muted-foreground">Expiry Date</th>
                      <th className="pb-2 font-medium text-muted-foreground">Reference</th>
                      <th className="pb-2 font-medium text-muted-foreground">Verified</th>
                      {isHRAdmin && (
                        <th className="pb-2 font-medium text-muted-foreground">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {complianceDocuments.map((doc) => (
                      <tr
                        key={doc.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-3 pr-4">
                          <div>
                            <p className="font-medium">{doc.document_type_name}</p>
                            {doc.file_name && (
                              <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={doc.status} />
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {formatHRDate(doc.issue_date)}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {formatHRDate(doc.expiry_date)}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {doc.reference_number || "—"}
                        </td>
                        <td className="py-3 pr-4">
                          {doc.verified_at ? (
                            <Badge variant="success" className="text-xs">
                              Verified
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        {isHRAdmin && (
                          <td className="py-3">
                            <div className="flex items-center gap-1">
                              {doc.file_path && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => handleDownload(doc.file_path!)}
                                  disabled={isPending}
                                  title="Download"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {!doc.verified_at && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-green-600 hover:text-green-700"
                                  onClick={() => handleVerify(doc.id)}
                                  disabled={isPending}
                                  title="Verify"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => setEditingDoc(doc)}
                                disabled={isPending}
                                title="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(doc)}
                                disabled={isPending}
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
