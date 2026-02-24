"use client";

import { useState, useMemo } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ABSENCE_TYPE_CONFIG,
  SICKNESS_CATEGORY_CONFIG,
  RTW_STATUS_CONFIG,
  formatHRDate,
  formatLeaveDays,
} from "@/lib/hr";
import type { RTWStatus } from "@/types/hr";
import Link from "next/link";
import { Search, Stethoscope, ClipboardCheck, ExternalLink } from "lucide-react";

// =============================================
// TYPES
// =============================================

interface AbsenceRow {
  id: string;
  profile_id: string;
  absence_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  is_long_term: boolean;
  sickness_category: string | null;
  reason: string | null;
  employee_name: string;
  rtw_status: RTWStatus | null;
  rtw_form_id: string | null;
}

interface PendingRTWRow {
  id: string;
  absence_record_id: string;
  employee_id: string;
  employee_name: string;
  absence_start_date: string;
  absence_end_date: string;
  status: RTWStatus;
  completed_at: string;
  completed_by_name: string | null;
}

interface AbsenceDashboardContentProps {
  absenceRecords: AbsenceRow[];
  pendingRTWForms: PendingRTWRow[];
  activeTab: string;
}

// =============================================
// COMPONENT
// =============================================

export function AbsenceDashboardContent({
  absenceRecords,
  pendingRTWForms,
  activeTab,
}: AbsenceDashboardContentProps) {
  const tab = ["all", "pending-rtw"].includes(activeTab) ? activeTab : "all";

  // Filters for All Absences tab
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filteredRecords = useMemo(() => {
    return absenceRecords.filter((r) => {
      if (search && !r.employee_name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (typeFilter !== "all" && r.absence_type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [absenceRecords, search, typeFilter]);

  return (
    <Tabs key={tab} defaultValue={tab} className="w-full">
      <TabsList>
        <TabsTrigger value="all">
          All Absences ({absenceRecords.length})
        </TabsTrigger>
        <TabsTrigger value="pending-rtw">
          Pending RTW ({pendingRTWForms.length})
        </TabsTrigger>
      </TabsList>

      {/* All Absences Tab */}
      <TabsContent value="all" className="mt-6 space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by employee name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(ABSENCE_TYPE_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {filteredRecords.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Stethoscope className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {absenceRecords.length === 0 ? "No absence records" : "No records match your filters"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Dates</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Days</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Category</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">RTW</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">View</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => {
                  const typeConfig = ABSENCE_TYPE_CONFIG[record.absence_type as keyof typeof ABSENCE_TYPE_CONFIG];
                  const rtwConfig = record.rtw_status ? RTW_STATUS_CONFIG[record.rtw_status] : null;
                  const categoryConfig = record.sickness_category
                    ? SICKNESS_CATEGORY_CONFIG[record.sickness_category as keyof typeof SICKNESS_CATEGORY_CONFIG]
                    : null;

                  return (
                    <tr key={record.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        <Link
                          href={`/hr/users/${record.profile_id}?tab=absence`}
                          className="text-primary hover:underline font-medium"
                        >
                          {record.employee_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {formatHRDate(record.start_date)} – {formatHRDate(record.end_date)}
                          {record.is_long_term && (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">
                              Long-term
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        {typeConfig ? (
                          <Badge className={`${typeConfig.bgColour} ${typeConfig.colour} border-0`}>
                            {typeConfig.label}
                          </Badge>
                        ) : (
                          record.absence_type
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {formatLeaveDays(record.total_days)}
                      </td>
                      <td className="px-4 py-2">
                        {categoryConfig?.label ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        {rtwConfig ? (
                          <Badge className={`${rtwConfig.bgColour} ${rtwConfig.colour} border-0`}>
                            {rtwConfig.label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/hr/users/${record.profile_id}?tab=absence`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>

      {/* Pending RTW Tab */}
      <TabsContent value="pending-rtw" className="mt-6">
        {pendingRTWForms.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No pending return-to-work forms</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Absence Period</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Completed By</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">View</th>
                </tr>
              </thead>
              <tbody>
                {pendingRTWForms.map((form) => {
                  const statusConfig = RTW_STATUS_CONFIG[form.status];
                  return (
                    <tr key={form.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        <Link
                          href={`/hr/users/${form.employee_id}?tab=absence`}
                          className="text-primary hover:underline font-medium"
                        >
                          {form.employee_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {formatHRDate(form.absence_start_date)} – {formatHRDate(form.absence_end_date)}
                      </td>
                      <td className="px-4 py-2">
                        {form.completed_by_name ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Badge className={`${statusConfig.bgColour} ${statusConfig.colour} border-0`}>
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/hr/users/${form.employee_id}?tab=absence`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
