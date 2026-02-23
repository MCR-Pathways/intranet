"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { KeyDateDialog } from "@/components/hr/key-date-dialog";
import { completeKeyDate, deleteKeyDate } from "@/app/(protected)/hr/key-dates/actions";
import { formatHRDate } from "@/lib/hr";
import { Plus, Check, Pencil, Trash2, CalendarClock } from "lucide-react";

interface KeyDateRow {
  id: string;
  profile_id: string;
  date_type: string;
  due_date: string;
  title: string;
  description: string | null;
  is_completed: boolean;
}

interface ProfileKeyDatesSectionProps {
  profileId: string;
  profileName: string;
  keyDates: KeyDateRow[];
  isHRAdmin?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  probation_end: "Probation",
  appraisal_due: "Appraisal",
  contract_end: "Contract",
  course_renewal: "Course",
  custom: "Custom",
};

export function ProfileKeyDatesSection({
  profileId, profileName, keyDates, isHRAdmin = false,
}: ProfileKeyDatesSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<KeyDateRow | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const active = keyDates.filter((kd) => !kd.is_completed);
  const completed = keyDates.filter((kd) => kd.is_completed);

  function handleComplete(id: string) {
    startTransition(async () => { await completeKeyDate(id); });
  }

  function handleDelete(id: string) {
    startTransition(async () => { await deleteKeyDate(id); });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Key Dates</CardTitle>
        {isHRAdmin && (
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {active.length === 0 && completed.length === 0 ? (
          <div className="flex flex-col items-center py-4 text-muted-foreground">
            <CalendarClock className="h-6 w-6 mb-1" />
            <p className="text-sm">No key dates</p>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((kd) => {
              const isOverdue = kd.due_date < today;
              return (
                <div
                  key={kd.id}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${isOverdue ? "bg-red-50" : "bg-muted/50"}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="shrink-0">
                      {TYPE_LABELS[kd.date_type] ?? kd.date_type}
                    </Badge>
                    <span className="truncate">{kd.title}</span>
                    <span className={`text-xs whitespace-nowrap ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {formatHRDate(kd.due_date)}
                    </span>
                  </div>
                  {isHRAdmin && (
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleComplete(kd.id)} disabled={isPending} title="Complete">
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditTarget(kd)} title="Edit">
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Delete">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete key date?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete this key date.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(kd.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              );
            })}
            {completed.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Completed</p>
                {completed.slice(0, 3).map((kd) => (
                  <div key={kd.id} className="flex items-center gap-2 px-3 py-1 text-sm text-muted-foreground line-through">
                    <span>{kd.title}</span>
                    <span className="text-xs">{formatHRDate(kd.due_date)}</span>
                  </div>
                ))}
                {completed.length > 3 && (
                  <p className="text-xs text-muted-foreground px-3">+{completed.length - 3} more</p>
                )}
              </div>
            )}
          </div>
        )}

        {isHRAdmin && (
          <>
            <KeyDateDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              profileId={profileId}
              profileName={profileName}
            />
            {editTarget && (
              <KeyDateDialog
                open={!!editTarget}
                onOpenChange={(val) => { if (!val) setEditTarget(null); }}
                profileId={profileId}
                profileName={profileName}
                existing={editTarget}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
