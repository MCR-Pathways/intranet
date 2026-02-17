import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTodaySignIns, getMonthlyHistory, getTeamSignInsToday } from "./actions";
import { SignInPageContent } from "@/components/sign-in/sign-in-page-content";

export default async function SignInPage() {
  const { user, profile } = await getCurrentUser();

  if (!user || !profile) {
    redirect("/login");
  }

  const [todaySignIns, monthlyHistory] = await Promise.all([
    getTodaySignIns(),
    getMonthlyHistory(),
  ]);

  // Fetch team data only for line managers
  const teamData = profile.is_line_manager
    ? await getTeamSignInsToday()
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Working Location</h1>
        <p className="text-muted-foreground mt-1">
          Record and track your working location
        </p>
      </div>
      <SignInPageContent
        todaySignIns={todaySignIns}
        monthlyHistory={monthlyHistory}
        teamData={teamData}
        isManager={!!profile.is_line_manager}
      />
    </div>
  );
}
