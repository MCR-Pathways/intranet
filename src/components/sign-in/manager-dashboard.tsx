"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamOverview } from "./team-overview";
import { ReportsPanel } from "./reports-panel";
import type { TeamMemberSignIn } from "@/types/database.types";

interface ManagerDashboardProps {
  teamMembers: TeamMemberSignIn[];
}

export function ManagerDashboard({ teamMembers }: ManagerDashboardProps) {
  return (
    <Tabs defaultValue="today" className="space-y-6">
      <TabsList>
        <TabsTrigger value="today">Today&apos;s Team</TabsTrigger>
        <TabsTrigger value="reports">Reports & Analytics</TabsTrigger>
      </TabsList>

      <TabsContent value="today">
        <TeamOverview members={teamMembers} />
      </TabsContent>

      <TabsContent value="reports">
        <ReportsPanel />
      </TabsContent>
    </Tabs>
  );
}
