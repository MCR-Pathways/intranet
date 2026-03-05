"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeekStrip } from "./week-strip";
import type { WorkingLocationEntry } from "@/lib/sign-in";

interface WorkingLocationContentProps {
  initialEntries: WorkingLocationEntry[];
  isManager: boolean;
  defaultTab?: string;
}

export function WorkingLocationContent({
  initialEntries,
  isManager,
  defaultTab = "my-schedule",
}: WorkingLocationContentProps) {
  return (
    <Tabs key={defaultTab} defaultValue={defaultTab}>
      <TabsList>
        <TabsTrigger value="my-schedule">My Schedule</TabsTrigger>
        {isManager && (
          <TabsTrigger value="team-schedule">Team Schedule</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="my-schedule" className="mt-6">
        <WeekStrip initialEntries={initialEntries} />
      </TabsContent>

      {isManager && (
        <TabsContent value="team-schedule" className="mt-6">
          <div className="rounded-lg border p-6">
            <p className="text-sm text-muted-foreground">
              Team schedule grid coming in Phase 5.
            </p>
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
}
