"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComplianceStatusGrid } from "./compliance-status-grid";
import {
  COMPLIANCE_STATUS_CONFIG,
  DEPARTMENT_CONFIG,
  formatHRDate,
} from "@/lib/hr";
import type { ComplianceStatus, Department } from "@/lib/hr";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Search,
} from "lucide-react";

// =============================================
// TYPES
// =============================================

interface DocumentType {
  id: string;
  name: string;
}

interface ComplianceDocumentRow {
  id: string;
  profile_id: string;
  document_type_id: string;
  document_type_name: string;
  employee_name: string;
  department: string | null;
  status: ComplianceStatus;
  issue_date: string | null;
  expiry_date: string | null;
  reference_number: string | null;
  file_name: string | null;
  verified_at: string | null;
}

interface EmployeeGridRow {
  profile_id: string;
  full_name: string;
  department: string | null;
  statuses: Record<string, ComplianceStatus>;
}

interface ComplianceDashboardProps {
  documentTypes: DocumentType[];
  documents: ComplianceDocumentRow[];
  employeeGrid: EmployeeGridRow[];
  summary: {
    total: number;
    valid: number;
    expiring_soon: number;
    expired: number;
  };
}

// =============================================
// STATUS BADGE
// =============================================

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const config = COMPLIANCE_STATUS_CONFIG[status] ?? COMPLIANCE_STATUS_CONFIG.not_applicable;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${config.dotColour}`} />
      <span className={`text-xs font-medium ${config.colour}`}>{config.label}</span>
    </div>
  );
}

// =============================================
// MAIN COMPONENT
// =============================================

export function ComplianceDashboard({
  documentTypes,
  documents,
  employeeGrid,
  summary,
}: ComplianceDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  // Filter document rows
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        doc.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.document_type_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.reference_number && doc.reference_number.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
      const matchesType = typeFilter === "all" || doc.document_type_id === typeFilter;
      const matchesDepartment = departmentFilter === "all" || doc.department === departmentFilter;
      return matchesSearch && matchesStatus && matchesType && matchesDepartment;
    });
  }, [documents, searchQuery, statusFilter, typeFilter, departmentFilter]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Valid</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{summary.valid}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {summary.expiring_soon}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{summary.expired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Expiry Status Grid */}
      <ComplianceStatusGrid
        documentTypes={documentTypes}
        employees={employeeGrid}
      />

      {/* All Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">All Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee, type, or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Document Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {documentTypes.map((dt) => (
                  <SelectItem key={dt.id} value={dt.id}>
                    {dt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {Object.entries(DEPARTMENT_CONFIG).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Employee</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Document</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Issue Date</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Expiry Date</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Reference</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Verified</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No documents found
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/hr/users/${doc.profile_id}?tab=documents`}
                          className="font-medium hover:underline"
                        >
                          {doc.employee_name}
                        </Link>
                        {doc.department && (
                          <p className="text-xs text-muted-foreground">
                            {DEPARTMENT_CONFIG[doc.department as Department]?.label ?? doc.department}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">{doc.document_type_name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatHRDate(doc.issue_date)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatHRDate(doc.expiry_date)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {doc.reference_number || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {doc.verified_at ? (
                          <Badge variant="success" className="text-xs">
                            Verified
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            {filteredDocuments.length} of {documents.length} documents
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
