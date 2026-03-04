"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddLocationForm } from "./add-location-form";
import { TodayTimeline } from "./today-timeline";
import { MonthlyHistory } from "./monthly-history";
import { ManagerDashboard } from "./manager-dashboard";
import type { TeamMemberSignIn } from "@/types/database.types";
import type { SignInEntry } from "@/lib/sign-in";

interface TeamData {
  members: TeamMemberSignIn[];
  error: string | null;
}

interface SignInPageContentProps {
  todaySignIns: SignInEntry[];
  monthlyHistory: SignInEntry[];
  teamData: TeamData | null;
  isManager: boolean;
}

export function SignInPageContent({
  todaySignIns,
  monthlyHistory,
  teamData,
  isManager,
}: SignInPageContentProps) {
  const hasTeamData = isManager && teamData && !teamData.error;

  if (hasTeamData) {
    return (
      <Tabs defaultValue="my-location" className="space-y-6">
        <TabsList>
          <TabsTrigger value="my-location">My Location</TabsTrigger>
          <TabsTrigger value="team-dashboard">Team Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="my-location" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <AddLocationForm />
            <TodayTimeline entries={todaySignIns} />
          </div>
          <MonthlyHistory entries={monthlyHistory} />
        </TabsContent>

        <TabsContent value="team-dashboard">
          <ManagerDashboard teamMembers={teamData.members} />
        </TabsContent>
      </Tabs>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <AddLocationForm />
        <TodayTimeline entries={todaySignIns} />
      </div>
      <MonthlyHistory entries={monthlyHistory} />
    </div>
  );
}
