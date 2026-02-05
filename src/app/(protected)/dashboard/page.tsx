import { createClient } from "@/lib/supabase/server";
import { requireUserWithProfile } from "@/lib/auth/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Newspaper,
  GraduationCap,
  Calendar,
  MapPin,
  ClipboardList,
  Bell,
} from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { profile } = await requireUserWithProfile(supabase);

  const displayName =
    profile?.preferred_name || profile?.full_name || "there";
  const isStaff = profile?.user_type === "staff";
  const needsInduction = !profile?.induction_completed_at;

  // Get greeting based on time of day
  const hour = new Date().getHours();
  let greeting = "Good morning";
  if (hour >= 12 && hour < 17) {
    greeting = "Good afternoon";
  } else if (hour >= 17) {
    greeting = "Good evening";
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {greeting}, {displayName}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Welcome to the MCR Pathways Intranet
        </p>
      </div>

      {/* Induction prompt */}
      {needsInduction && (
        <Card className="border-secondary bg-secondary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-secondary" />
              <CardTitle className="text-lg">Complete Your Induction</CardTitle>
            </div>
            <CardDescription>
              You have outstanding induction items to complete before you can
              access all features of the intranet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/intranet/induction"
              className="inline-flex items-center gap-2 text-sm font-medium text-secondary hover:underline"
            >
              Go to Induction Checklist
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick actions grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* News Feed */}
        <Link href="/intranet">
          <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">News Feed</CardTitle>
              <Newspaper className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">5</p>
              <p className="text-xs text-muted-foreground">
                New posts this week
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Learning */}
        <Link href="/learning">
          <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Learning</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">2</p>
                <Badge variant="warning">Due soon</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Compliance courses pending
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Staff-only cards */}
        {isStaff && (
          <>
            {/* Calendar */}
            <Link href="/hr/calendar">
              <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Today&apos;s Schedule
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">3</p>
                  <p className="text-xs text-muted-foreground">
                    Events scheduled
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Sign In */}
            <Link href="/sign-in">
              <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Sign In</CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <Badge variant="muted">Not signed in</Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    Record your working location
                  </p>
                </CardContent>
              </Card>
            </Link>
          </>
        )}

        {/* Notifications */}
        <Card className="transition-shadow hover:shadow-md h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Notifications</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">3</p>
              <Badge variant="destructive">Unread</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Notifications waiting
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent news */}
        <Card>
          <CardHeader>
            <CardTitle>Recent News</CardTitle>
            <CardDescription>Latest posts from the news feed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                No recent news to display
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Frequently accessed resources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Link
                href="/intranet/guides"
                className="block text-sm text-primary hover:underline"
              >
                MCR Pathways Guides
              </Link>
              <Link
                href="/intranet/policies"
                className="block text-sm text-primary hover:underline"
              >
                Company Policies
              </Link>
              <Link
                href="/learning/tool-shed"
                className="block text-sm text-primary hover:underline"
              >
                Tool Shed
              </Link>
              {isStaff && (
                <>
                  <Link
                    href="/hr/leave"
                    className="block text-sm text-primary hover:underline"
                  >
                    Request Leave
                  </Link>
                  <Link
                    href="/hr/org-chart"
                    className="block text-sm text-primary hover:underline"
                  >
                    Organisation Chart
                  </Link>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
