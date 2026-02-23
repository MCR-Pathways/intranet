"use client";

import { useState, useMemo, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { KeyDateDialog } from "@/components/hr/key-date-dialog";
import { completeKeyDate, deleteKeyDate } from "@/app/(protected)/hr/key-dates/actions";
import { formatHRDate } from "@/lib/hr";
import { Plus, Search, Check, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

interface KeyDateRow {
  id: string;
  profile_id: string;
  date_type: string;
  due_date: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  employee_name: string;
}

interface Employee {
  id: string;
  full_name: string;
}

interface KeyDatesDashboardProps {
  keyDates: KeyDateRow[];
  employees: Employee[];
}

const TYPE_LABELS: Record<string, string> = {
  probation_end: "Probation End",
  appraisal_due: "Appraisal Due",
  contract_end: "Contract End",
  course_renewal: "Course Renewal",
  custom: "Custom",
};

export function KeyDatesDashboard({ keyDates, employees }: KeyDatesDashboardProps) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<KeyDateRow | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    return keyDates.filter((kd) => {
      if (!showCompleted && kd.is_completed) return false;
      if (typeFilter !== "all" && kd.date_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!kd.employee_name.toLowerCase().includes(q) && !kd.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [keyDates, showCompleted, typeFilter, search]);

  const overdue = filtered.filter((kd) => !kd.is_completed && kd.due_date < today);
  const upcoming = filtered.filter((kd) => !kd.is_completed && kd.due_date >= today);
  const completed = filtered.filter((kd) => kd.is_completed);

  function handleComplete(id: string) {
    startTransition(async () => { await completeKeyDate(id); });
  }

  function handleDelete(id: string) {
    startTransition(async () => { await deleteKeyDate(id); });
  }

  function renderTable(items: KeyDateRow[], label: string, highlight?: boolean) {
    if (items.length === 0) return null;
    return (
      <div>
        <h3 className={`text-sm font-semibold mb-2 ${highlight ? "text-destructive" : "text-muted-foreground"}`}>
          {label} ({items.length})
        </h3>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Employee</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Due Date</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((kd) => (
                <tr key={kd.id} className={`border-b last:border-0 hover:bg-muted/50 ${highlight ? "bg-red-50/50" : ""}`}>
                  <td className="px-4 py-2">
                    <Link href={`/hr/users/${kd.profile_id}?tab=overview`} className="hover:underline text-primary">
                      {kd.employee_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="outline">{TYPE_LABELS[kd.date_type] ?? kd.date_type}</Badge>
                  </td>
                  <td className="px-4 py-2">{kd.title}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className={highlight ? "text-destructive font-medium" : ""}>
                      {formatHRDate(kd.due_date)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {!kd.is_completed && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleComplete(kd.id)} title="Mark complete" disabled={isPending}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditTarget(kd)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete key date?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently remove this key date.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(kd.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-[200px]" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={showCompleted ? "secondary" : "outline"} size="sm" onClick={() => setShowCompleted(!showCompleted)}>
          {showCompleted ? "Hide Completed" : "Show Completed"}
        </Button>
        <Button onClick={() => setCreateOpen(true)} className="ml-auto">
          <Plus className="h-4 w-4 mr-1" /> Add Key Date
        </Button>
      </div>

      {/* Sections */}
      {renderTable(overdue, "Overdue", true)}
      {renderTable(upcoming, "Upcoming")}
      {showCompleted && renderTable(completed, "Completed")}

      {overdue.length === 0 && upcoming.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No key dates found</p>
      )}

      {/* Dialogs */}
      <KeyDateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        employees={employees}
      />
      {editTarget && (
        <KeyDateDialog
          open={!!editTarget}
          onOpenChange={(val) => { if (!val) setEditTarget(null); }}
          profileId={editTarget.profile_id}
          profileName={editTarget.employee_name}
          existing={editTarget}
        />
      )}
    </div>
  );
}
