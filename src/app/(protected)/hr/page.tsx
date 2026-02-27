import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
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
  Network,
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
// QUICK ACTION CARD
// =============================================

interface QuickActionProps {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  isAdmin?: boolean;
}

function QuickActionCard({ title, description, href, icon: Icon, isAdmin }: QuickActionProps) {
  return (
    <Link href={href}>
      <Card className={`transition-shadow hover:shadow-md cursor-pointer h-full ${isAdmin ? "border-primary/20" : ""}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className={`h-4 w-4 ${isAdmin ? "text-primary" : "text-muted-foreground"}`} />
        </CardHeader>
        <CardContent>
          <CardDescription>{description}</CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}

// =============================================
// SECTION HEADER
// =============================================

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
      {children}
    </h2>
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
    supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today),
    supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", threeDaysAgo),
    supabase
      .from("compliance_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "expiring_soon"),
    supabase
      .from("compliance_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "expired"),
    supabase
      .from("key_dates")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false)
      .lt("due_date", today),
    supabase
      .from("return_to_work_forms")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
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

  const stats = isHRAdmin ? await fetchDashboardStats(supabase) : null;

  const greeting = getGreeting();
  const firstName = getFirstName(profile?.full_name ?? null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${firstName}`}
        subtitle="Manage your profile, leave, and team"
      />

      {/* HR Admin dashboard stats — only show cards that need attention */}
      {isHRAdmin && stats && (() => {
        const allCards: (StatCardProps | false)[] = [
          stats.onLeaveToday > 0 && {
            title: "On Leave Today",
            value: stats.onLeaveToday,
            subtitle: "staff currently on leave",
            href: "/hr/calendar",
            icon: Calendar,
            iconColour: "text-blue-600",
            valueColour: "text-blue-700",
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
          : "max-w-sm";

        return (
          <div className={`grid gap-4 ${actionCards.length === 1 ? "" : "sm:grid-cols-2"} ${gridCols}`}>
            {actionCards.map((card) => (
              <StatCard key={card.title} {...card} />
            ))}
          </div>
        );
      })()}

      {/* My HR */}
      <section>
        <SectionHeader>My HR</SectionHeader>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            title="My Profile"
            description="View and update your personal information"
            href="/hr/profile"
            icon={User}
          />
          <QuickActionCard
            title="Leave"
            description="Request and manage your leave"
            href="/hr/leave"
            icon={Calendar}
          />
          {canViewCalendar && (
            <QuickActionCard
              title="Calendar"
              description="View team leave calendar"
              href="/hr/calendar"
              icon={CalendarClock}
            />
          )}
          <QuickActionCard
            title="My Team"
            description="View your team members"
            href="/hr/team"
            icon={Users}
          />
          <QuickActionCard
            title="Assets"
            description="View company assets assigned to you"
            href="/hr/assets"
            icon={Package}
          />
        </div>
      </section>

      {/* Organisation */}
      <section>
        <SectionHeader>Organisation</SectionHeader>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            title="Org Chart"
            description="View the organisation structure"
            href="/hr/org-chart"
            icon={Network}
          />
        </div>
      </section>

      {/* Administration (HR Admin only) */}
      {isHRAdmin && (
        <section>
          <SectionHeader>Administration</SectionHeader>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <QuickActionCard
              title="User Management"
              description="Manage staff profiles, roles, and induction"
              href="/hr/users"
              icon={Shield}
              isAdmin
            />
            <QuickActionCard
              title="Absence & Sickness"
              description="Record absences, manage return-to-work forms"
              href="/hr/absence"
              icon={Stethoscope}
              isAdmin
            />
            <QuickActionCard
              title="Compliance"
              description="Track compliance documents and expiry dates"
              href="/hr/compliance"
              icon={FileCheck}
              isAdmin
            />
            <QuickActionCard
              title="Key Dates"
              description="Track probations, appraisals, and contract renewals"
              href="/hr/key-dates"
              icon={CalendarClock}
              isAdmin
            />
            <QuickActionCard
              title="Leaving / Offboarding"
              description="Manage staff leaving forms and offboarding"
              href="/hr/leaving"
              icon={UserMinus}
              isAdmin
            />
          </div>
        </section>
      )}
    </div>
  );
}
