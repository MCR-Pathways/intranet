import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSignInHistory, getTeamSignInsToday } from "./actions";
import { SignInPageContent } from "@/components/sign-in/sign-in-page-content";

export default async function SignInPage() {
  const { user, profile } = await getCurrentUser();

  if (!user || !profile) {
    redirect("/login");
  }

  // Single query fetches both today + 30-day history
  const [signInHistory, teamData] = await Promise.all([
    getSignInHistory(),
    profile.is_line_manager ? getTeamSignInsToday() : null,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Working Location"
        subtitle="Record and track your working location"
      />
      <SignInPageContent
        todaySignIns={signInHistory.today}
        monthlyHistory={signInHistory.history}
        teamData={teamData}
        isManager={!!profile.is_line_manager}
      />
    </div>
  );
}
