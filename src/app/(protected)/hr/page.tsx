import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  Users,
  Calendar,
  User,
  Shield,
  FileCheck,
  CalendarClock,
  Package,
} from "lucide-react";

export default async function HRPage() {
  const { profile } = await getCurrentUser();
  const isHRAdmin = profile?.is_hr_admin ?? false;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">HR</h1>
        <p className="text-muted-foreground mt-1">
          Manage your profile, leave, and team
        </p>
      </div>

      {/* Quick actions grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/hr/profile">
          <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">My Profile</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                View and update your personal information
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/hr/org-chart">
          <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Org Chart</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                View the organisation structure
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/hr/leave">
          <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Leave</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Request and manage your leave
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/hr/calendar">
          <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Calendar</CardTitle>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                View team leave calendar
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/hr/team">
          <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">My Team</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                View your team members
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/hr/assets">
          <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Assets</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                View company assets assigned to you
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        {isHRAdmin && (
          <Link href="/hr/users">
            <Card className="transition-shadow hover:shadow-md cursor-pointer h-full border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  User Management
                </CardTitle>
                <Shield className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Manage staff profiles, roles, and induction
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        )}

        {isHRAdmin && (
          <Link href="/hr/compliance">
            <Card className="transition-shadow hover:shadow-md cursor-pointer h-full border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Compliance
                </CardTitle>
                <FileCheck className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Track compliance documents and expiry dates
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        )}

        {isHRAdmin && (
          <Link href="/hr/key-dates">
            <Card className="transition-shadow hover:shadow-md cursor-pointer h-full border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Key Dates
                </CardTitle>
                <CalendarClock className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Track probations, appraisals, and contract renewals
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
