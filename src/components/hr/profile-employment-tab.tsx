"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EMPLOYMENT_EVENT_CONFIG, formatHRDate } from "@/lib/hr";
import type { EmploymentHistoryEntry } from "@/types/hr";
import { History } from "lucide-react";

interface ProfileEmploymentTabProps {
  employmentHistory: EmploymentHistoryEntry[];
}

export function ProfileEmploymentTab({ employmentHistory }: ProfileEmploymentTabProps) {
  if (employmentHistory.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <History className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">
            No employment history recorded yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Employment History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-6">
            {employmentHistory.map((entry) => {
              const config = EMPLOYMENT_EVENT_CONFIG[entry.event_type] ?? {
                label: entry.event_type,
                colour: "text-gray-600",
              };

              return (
                <div key={entry.id} className="relative pl-7">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background ${config.colour.replace("text-", "bg-")}`}
                  />

                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                    <div>
                      <p className={`text-sm font-medium ${config.colour}`}>
                        {config.label}
                      </p>
                      {entry.previous_value && entry.new_value && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {entry.previous_value} → {entry.new_value}
                        </p>
                      )}
                      {entry.new_value && !entry.previous_value && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {entry.new_value}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatHRDate(entry.effective_date)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
