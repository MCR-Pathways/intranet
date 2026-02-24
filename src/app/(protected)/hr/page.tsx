import { getCurrentUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import {
  Users,
  Calendar,
  User,
  Shield,
  FileCheck,
  CalendarClock,
  Package,
  Clock,
  AlertTriangle,
  Stethoscope,
  ClipboardCheck,
  UserMinus,
} from "lucide-react";

// =============================================
// HELPERS
// =============================================

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getFirstName(fullName: string | null): string {
  if (!fullName) return "";
  return fullName.split(" ")[0];
}

// =============================================
// DASHBOARD STAT CARD
// =============================================

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  href: string;
  icon: React.ElementType;
  iconColour: string;
  valueColour: string;
}

function StatCard({
  title,
  value,
  subtitle,
  href,
  icon: Icon,
  iconColour,
  valueColour,
}: StatCardProps) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className={`h-4 w-4 ${iconColour}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${valueColour}`}>{value}</div>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

// =============================================
// DATA FETCHING (HR admin only)
// =============================================

async function fetchDashboardStats(supabase: Awaited<ReturnType<typeof getCurrentUser>>["supabase"]) {
  const today = new Date().toISOString().split("T")[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const [
    onLeaveResult,
    staleResult,
    expiringResult,
    expiredResult,
    overdueResult,
    pendingRTWResult,
    activeLeaversResult,
  ] = await Promise.all([
    // Staff on leave today
    supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today),
    // Stale leave requests (pending 3+ days)
    supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", threeDaysAgo),
    // Compliance expiring soon
    supabase
      .from("compliance_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "expiring_soon"),
    // Compliance expired
    supabase
      .from("compliance_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "expired"),
    // Key dates overdue
    supabase
      .from("key_dates")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false)
      .lt("due_date", today),
    // Pending RTW forms (awaiting employee confirmation)
    supabase
      .from("return_to_work_forms")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
    // Active leaving forms (draft, submitted, in_progress)
    supabase
      .from("staff_leaving_forms")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "submitted", "in_progress"]),
  ]);

  return {
    onLeaveToday: onLeaveResult.count ?? 0,
    staleRequests: staleResult.count ?? 0,
    complianceExpiring: expiringResult.count ?? 0,
    complianceExpired: expiredResult.count ?? 0,
    keyDatesOverdue: overdueResult.count ?? 0,
    pendingRTW: pendingRTWResult.count ?? 0,
    activeLeavers: activeLeaversResult.count ?? 0,
  };
}

// =============================================
// PAGE
// =============================================

export default async function HRPage() {
  const { supabase, profile } = await getCurrentUser();
  const isHRAdmin = profile?.is_hr_admin ?? false;
  const isLineManager = profile?.is_line_manager ?? false;
  const canViewCalendar = isHRAdmin || isLineManager;

  // Only fetch stats for HR admins
  const stats = isHRAdmin ? await fetchDashboardStats(supabase) : null;

  const greeting = getGreeting();
  const firstName = getFirstName(profile?.full_name ?? null);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {greeting}, {firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your profile, leave, and team
        </p>
      </div>

      {/* HR Admin dashboard stats — only show cards that need attention */}
      {isHRAdmin && stats && (() => {
        const allCards: (StatCardProps | false)[] = [
          stats.onLeaveToday > 0 && {
            title: "On Leave Today",
            value: stats.onLeaveToday,
            subtitle: "staff currently on leave",
            href: "/hr/calendar",
            icon: Calendar,
            iconColour: "text-muted-foreground",
            valueColour: "",
          },
          stats.staleRequests > 0 && {
            title: "Stale Leave Requests",
            value: stats.staleRequests,
            subtitle: "pending 3+ days",
            href: "/hr/leave",
            icon: Clock,
            iconColour: "text-amber-600",
            valueColour: "text-amber-700",
          },
          (stats.complianceExpiring + stats.complianceExpired) > 0 && {
            title: "Compliance Attention",
            value: stats.complianceExpiring + stats.complianceExpired,
            subtitle: stats.complianceExpired > 0
              ? `${stats.complianceExpired} expired, ${stats.complianceExpiring} expiring soon`
              : `${stats.complianceExpiring} expiring soon`,
            href: "/hr/compliance",
            icon: AlertTriangle,
            iconColour: stats.complianceExpired > 0 ? "text-red-600" : "text-amber-600",
            valueColour: stats.complianceExpired > 0 ? "text-red-700" : "text-amber-700",
          },
          stats.keyDatesOverdue > 0 && {
            title: "Key Dates Overdue",
            value: stats.keyDatesOverdue,
            subtitle: "need attention",
            href: "/hr/key-dates",
            icon: CalendarClock,
            iconColour: "text-red-600",
            valueColour: "text-red-700",
          },
          stats.pendingRTW > 0 && {
            title: "Pending RTW Forms",
            value: stats.pendingRTW,
            subtitle: "awaiting confirmation",
            href: "/hr/absence",
            icon: ClipboardCheck,
            iconColour: "text-amber-600",
            valueColour: "text-amber-700",
          },
          stats.activeLeavers > 0 && {
            title: "Active Leavers",
            value: stats.activeLeavers,
            subtitle: "offboarding in progress",
            href: "/hr/leaving",
            icon: UserMinus,
            iconColour: "text-orange-600",
            valueColour: "text-orange-700",
          },
        ];
        const actionCards = allCards.filter((c): c is StatCardProps => c !== false);

        if (actionCards.length === 0) return null;

        const gridCols =
          actionCards.length >= 4 ? "lg:grid-cols-4"
          : actionCards.length === 3 ? "lg:grid-cols-3"
          : actionCards.length === 2 ? "lg:grid-cols-2"
          : "";

        return (
          <div className={`grid gap-4 sm:grid-cols-2 ${gridCols}`}>
            {actionCards.map((card) => (
              <StatCard key={card.title} {...card} />
            ))}
          </div>
        );
      })()}

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

        {canViewCalendar && (
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
        )}

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

        {isHRAdmin && (
          <Link href="/hr/absence">
            <Card className="transition-shadow hover:shadow-md cursor-pointer h-full border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Absence & Sickness
                </CardTitle>
                <Stethoscope className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Record absences, manage return-to-work forms
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        )}

        {isHRAdmin && (
          <Link href="/hr/leaving">
            <Card className="transition-shadow hover:shadow-md cursor-pointer h-full border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Leaving / Offboarding
                </CardTitle>
                <UserMinus className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Manage staff leaving forms and offboarding
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
