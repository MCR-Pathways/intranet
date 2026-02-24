"use client";

import { useState, useMemo } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LEAVING_STATUS_CONFIG,
  LEAVING_REASON_CONFIG,
  formatHRDate,
} from "@/lib/hr";
import type { StaffLeavingFormWithEmployee } from "@/types/hr";
import { CreateLeavingFormDialog } from "./create-leaving-form-dialog";
import { Plus, UserX, Search } from "lucide-react";
import Link from "next/link";

interface LeavingFormRow extends StaffLeavingFormWithEmployee {
  initiator_name: string | null;
}

interface Employee {
  id: string;
  full_name: string;
  job_title: string | null;
}

interface LeavingDashboardContentProps {
  leavingForms: LeavingFormRow[];
  activeEmployees: Employee[];
  activeTab: string;
}

export function LeavingDashboardContent({
  leavingForms,
  activeEmployees,
  activeTab,
}: LeavingDashboardContentProps) {
  const tab = ["active", "completed", "all"].includes(activeTab) ? activeTab : "active";
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const activeForms = useMemo(
    () => leavingForms.filter((f) => ["draft", "submitted", "in_progress"].includes(f.status)),
    [leavingForms],
  );

  const completedForms = useMemo(
    () => leavingForms.filter((f) => f.status === "completed"),
    [leavingForms],
  );

  const allForms = useMemo(
    () => leavingForms.filter((f) => f.status !== "cancelled"),
    [leavingForms],
  );

  function filterBySearch<T extends { employee_name: string; reason_for_leaving: string }>(
    forms: T[],
  ): T[] {
    if (!searchTerm.trim()) return forms;
    const term = searchTerm.toLowerCase();
    return forms.filter(
      (f) =>
        f.employee_name.toLowerCase().includes(term) ||
        LEAVING_REASON_CONFIG[f.reason_for_leaving as keyof typeof LEAVING_REASON_CONFIG]?.label
          .toLowerCase()
          .includes(term),
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Leaving Form
        </Button>
      </div>

      <Tabs key={tab} defaultValue={tab} className="w-full">
        <TabsList>
          <TabsTrigger value="active">
            Active ({activeForms.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedForms.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({allForms.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <FormTable forms={filterBySearch(activeForms)} emptyMessage="No active leaving forms." />
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <FormTable forms={filterBySearch(completedForms)} emptyMessage="No completed leaving forms." />
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <FormTable forms={filterBySearch(allForms)} emptyMessage="No leaving forms." />
        </TabsContent>
      </Tabs>

      <CreateLeavingFormDialog
        employees={activeEmployees}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}

// =============================================
// Table component
// =============================================

function FormTable({
  forms,
  emptyMessage,
}: {
  forms: LeavingFormRow[];
  emptyMessage: string;
}) {
  if (forms.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <UserX className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Employee</th>
            <th className="px-4 py-3 text-left font-medium">Leaving Date</th>
            <th className="px-4 py-3 text-left font-medium">Reason</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Initiated By</th>
            <th className="px-4 py-3 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {forms.map((form) => {
            const statusConfig = LEAVING_STATUS_CONFIG[form.status];
            const reasonConfig = LEAVING_REASON_CONFIG[form.reason_for_leaving];

            return (
              <tr key={form.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">{form.employee_name}</p>
                    {form.employee_job_title && (
                      <p className="text-xs text-muted-foreground">{form.employee_job_title}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{formatHRDate(form.leaving_date)}</td>
                <td className="px-4 py-3">{reasonConfig?.label ?? form.reason_for_leaving}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={`${statusConfig.colour} ${statusConfig.bgColour} border-0`}>
                    {statusConfig.label}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {form.initiator_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/hr/leaving/${form.id}`}>View</Link>
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
