"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { COMPLIANCE_STATUS_CONFIG } from "@/lib/hr";
import type { ComplianceStatus } from "@/lib/hr";
import { Search } from "lucide-react";

interface DocumentType {
  id: string;
  name: string;
}

interface EmployeeComplianceRow {
  profile_id: string;
  full_name: string;
  department: string | null;
  /** Map of document_type_id → status. Missing means no document uploaded. */
  statuses: Record<string, ComplianceStatus>;
}

interface ComplianceStatusGridProps {
  documentTypes: DocumentType[];
  employees: EmployeeComplianceRow[];
}

/** Status dot with tooltip. */
function StatusDot({
  status,
  typeName,
}: {
  status: ComplianceStatus | "missing";
  typeName: string;
}) {
  const config =
    status === "missing"
      ? { label: "Missing", dotColour: "bg-gray-300" }
      : COMPLIANCE_STATUS_CONFIG[status] ?? COMPLIANCE_STATUS_CONFIG.not_applicable;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-block h-3 w-3 rounded-full ${config.dotColour} cursor-default`}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {typeName}: {config.label}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ComplianceStatusGrid({
  documentTypes,
  employees,
}: ComplianceStatusGridProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.full_name.toLowerCase().includes(q) ||
        (emp.department && emp.department.toLowerCase().includes(q))
    );
  }, [employees, searchQuery]);

  if (documentTypes.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-sm font-medium">
            Expiry Status Grid
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-4 font-medium text-muted-foreground whitespace-nowrap">
                  Employee
                </th>
                {documentTypes.map((dt) => (
                  <th
                    key={dt.id}
                    className="pb-2 px-2 font-medium text-muted-foreground text-center"
                    title={dt.name}
                  >
                    <span className="text-xs whitespace-nowrap">
                      {/* Abbreviate long names */}
                      {dt.name.length > 12
                        ? dt.name.slice(0, 10) + "…"
                        : dt.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={documentTypes.length + 1}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No employees found
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr
                    key={emp.profile_id}
                    className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/hr/users/${emp.profile_id}?tab=documents`}
                        className="font-medium hover:underline whitespace-nowrap"
                      >
                        {emp.full_name}
                      </Link>
                    </td>
                    {documentTypes.map((dt) => {
                      const status = emp.statuses[dt.id] ?? "missing";
                      return (
                        <td key={dt.id} className="py-2.5 px-2 text-center">
                          <StatusDot status={status} typeName={dt.name} />
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
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
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
            Missing
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
