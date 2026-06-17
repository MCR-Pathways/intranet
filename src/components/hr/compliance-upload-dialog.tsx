"use client";

import { useState, useTransition, useRef } from "react";
import { uploadComplianceDocument } from "@/app/(protected)/hr/compliance/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X } from "lucide-react";
import { HR_DOCUMENT_MAX_SIZE_BYTES } from "@/lib/hr";
import { toast } from "sonner";

interface DocumentType {
  id: string;
  name: string;
}

interface ComplianceUploadDialogProps {
  /** The employee this document is for. */
  profileId: string;
  profileName: string;
  /** Available compliance document types. */
  documentTypes: DocumentType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComplianceUploadDialog({
  profileId,
  profileName,
  documentTypes,
  open,
  onOpenChange,
}: ComplianceUploadDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documentTypeId, setDocumentTypeId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const resetForm = () => {
    setDocumentTypeId("");
    setReferenceNumber("");
    setIssueDate("");
    setExpiryDate("");
    setNotes("");
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > HR_DOCUMENT_MAX_SIZE_BYTES) {
      setError(`File too large. Maximum size is ${HR_DOCUMENT_MAX_SIZE_BYTES / (1024 * 1024)}MB.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setError(null);
    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!documentTypeId) {
      setError("Please select a document type.");
      return;
    }

    const formData = new FormData();
    formData.set("profile_id", profileId);
    formData.set("document_type_id", documentTypeId);
    if (referenceNumber) formData.set("reference_number", referenceNumber);
    if (issueDate) formData.set("issue_date", issueDate);
    if (expiryDate) formData.set("expiry_date", expiryDate);
    if (notes) formData.set("notes", notes);
    if (selectedFile) formData.set("file", selectedFile);

    startTransition(async () => {
      const result = await uploadComplianceDocument(formData);
      if (result.success) {
        toast.success("Document uploaded");
        resetForm();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
        setError(result.error || "Failed to upload document");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Compliance Document</DialogTitle>
          <DialogDescription>
            Upload a compliance document for {profileName}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Document Type */}
            <div className="grid gap-2">
              <Label htmlFor="cu_doc_type">Document Type *</Label>
              <Select value={documentTypeId} onValueChange={setDocumentTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select document type..." />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((dt) => (
                    <SelectItem key={dt.id} value={dt.id}>
                      {dt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reference Number */}
            <div className="grid gap-2">
              <Label htmlFor="cu_ref">Reference Number</Label>
              <Input
                id="cu_ref"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. PVG-123456"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cu_issue">Issue Date</Label>
                <Input
                  id="cu_issue"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cu_expiry">Expiry Date</Label>
                <Input
                  id="cu_expiry"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>

            {/* File Upload */}
            <div className="grid gap-2">
              <Label>Document File</Label>
              {selectedFile ? (
                <div className="flex items-center gap-2 rounded-md border p-3">
                  <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(selectedFile.size / 1024).toFixed(0)} KB
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleRemoveFile}
                    aria-label="Remove selected file"
                    title="Remove file"
                  >
                    <X />
                  </Button>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to select a file
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, JPEG, PNG, or DOCX (max 10MB)
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="cu_notes">Notes</Label>
              <Textarea
                id="cu_notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this document..."
                rows={3}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Uploading..." : "Upload Document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
