"use client";

import Link from "next/link";
import {
usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Newspaper,
  Users,
  GraduationCap,
  MapPin,
  Settings,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { isHRAdminEffective, isLDAdminEffective, isSystemsAdminEffective } from "@/lib/auth-helpers";
import type { Profile, UserType } from "@/types/database.types";

// =============================================
// NAVIGATION DATA MODEL
// =============================================

interface NavChild {
  name: string;
  href: string;
}

interface NavGroup {
  label: string | null;
  items: NavChild[];
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  module: string | null;
  children?: NavGroup[];
}

function getNavigation(
  isHRAdmin: boolean,
  isLDAdmin: boolean,
  isSystemsAdmin: boolean,
): NavItem[] {
  // HR admin items — filtered per role
  const hrAdminItems: NavChild[] = [];

  // User Management: HR admin OR systems admin
  if (isHRAdmin || isSystemsAdmin) {
    hrAdminItems.push({ name: "User Management", href: "/hr/users" });
  }

  // HR-only admin items
  if (isHRAdmin) {
    hrAdminItems.push(
      { name: "Onboarding", href: "/hr/onboarding" },
      { name: "Absence & Sickness", href: "/hr/absence" },
      { name: "Compliance", href: "/hr/compliance" },
      { name: "Key Dates", href: "/hr/key-dates" },
      { name: "Leaving", href: "/hr/leaving" },
      { name: "Departments", href: "/hr/departments" },
    );
  }

  const hrChildren: NavGroup[] = [
    {
      label: null,
      items: [
        { name: "My Profile", href: "/hr/profile" },
        { name: "Leave", href: "/hr/leave" },
        { name: "Assets", href: "/hr/assets" },
        { name: "Flexible Working", href: "/hr/flexible-working" },
      ],
    },
    {
      label: "People",
      items: [
        { name: "My Team", href: "/hr/team" },
        { name: "Org Chart", href: "/hr/org-chart" },
      ],
    },
    ...(hrAdminItems.length > 0
      ? [
          {
            label: "Admin",
            items: hrAdminItems,
          },
        ]
      : []),
  ];

  const learningChildren: NavGroup[] = [
    {
      label: null,
      items: [
        { name: "My Courses", href: "/learning/my-courses" },
        { name: "Compliance", href: "/learning/courses?category=compliance" },
        { name: "Upskilling", href: "/learning/courses?category=upskilling" },
        { name: "Tool Shed", href: "/learning/tool-shed" },
      ],
    },
    ...(isLDAdmin
      ? [
          {
            label: "Admin",
            items: [
              { name: "Course Management", href: "/learning/admin/courses" },
              { name: "Reports", href: "/learning/admin/reports" },
            ],
          },
        ]
      : []),
  ];

  const intranetChildren: NavGroup[] = [
    {
      label: null,
      items: [
        { name: "News Feed", href: "/intranet" },
        { name: "Weekly Round Up", href: "/intranet/weekly-roundup" },
        { name: "Resources", href: "/intranet/resources" },
        { name: "Surveys", href: "/intranet/surveys" },
      ],
    },
  ];

  return [
    {
      name: "Intranet",
      href: "/intranet",
      icon: Newspaper,
      module: "intranet",
      children: intranetChildren,
    },
    {
      name: "HR",
      href: "/hr",
      icon: Users,
      module: "hr",
      children: hrChildren,
    },
    {
      name: "Learning",
      href: "/learning",
      icon: GraduationCap,
      module: "learning",
      children: learningChildren,
    },
    { name: "Working Location", href: "/sign-in", icon: MapPin, module: "sign-in" },
  ];
}

const moduleAccess: Record<string, UserType[]> = {
  hr: ["staff"],
  "sign-in": ["staff"],
  learning: ["staff", "pathways_coordinator"],
  intranet: ["staff", "pathways_coordinator"],
};

// =============================================
// HELPERS
// =============================================

function isItemActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href || pathname.startsWith(item.href + "/")) return true;
  if (!item.children) return false;
  return item.children.some((group) =>
    group.items.some(
      (child) =>
        pathname === child.href || pathname.startsWith(child.href + "/")
    )
  );
}

function isChildActive(pathname: string, child: NavChild, parentHref: string): boolean {
  return (
    pathname === child.href ||
    (child.href !== parentHref && pathname.startsWith(child.href + "/"))
  );
}

// =============================================
// SIDEBAR COMPONENT
// =============================================

interface SidebarProps {
  profile: Profile | null;
  collapsed?: boolean;
  className?: string;
  onNavClick?: () => void;
}

export function Sidebar({ profile, collapsed = false, className, onNavClick }: SidebarProps) {
  const pathname = usePathname();

  const hasModuleAccess = (module: string): boolean => {
    if (!profile) return false;
    const allowedTypes = moduleAccess[module];
    if (!allowedTypes) return true;
    return allowedTypes.includes(profile.user_type);
  };

  const hrAdmin = isHRAdminEffective(profile);
  const ldAdmin = isLDAdminEffective(profile);
  const systemsAdmin = isSystemsAdminEffective(profile);

  const navigation = getNavigation(hrAdmin, ldAdmin, systemsAdmin);
  const filteredNav = navigation.filter(
    (item) => !item.module || hasModuleAccess(item.module)
  );

  const needsInduction = profile && !profile.induction_completed_at;

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-card transition-all duration-200",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      <ScrollArea className="flex-1 py-4">
        <nav className={cn("flex flex-col gap-3", collapsed ? "px-2" : "px-3")}>
          {/* Induction prompt for new users */}
          {needsInduction && !collapsed && (
            <Link
              href="/intranet/induction"
              onClick={onNavClick}
              className="mb-4 flex items-center gap-3 rounded-lg bg-secondary/10 px-3 py-3 text-sm font-medium text-secondary transition-colors hover:bg-secondary/20"
            >
              <ClipboardList className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Complete Induction</p>
                <p className="text-xs opacity-80">Required to continue</p>
              </div>
            </Link>
          )}

          {needsInduction && collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/intranet/induction"
                  onClick={onNavClick}
                  className="mb-4 flex items-center justify-center rounded-lg bg-secondary/10 p-2 text-secondary transition-colors hover:bg-secondary/20"
                >
                  <ClipboardList className="h-5 w-5 shrink-0" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Complete Induction</TooltipContent>
            </Tooltip>
          )}

          {filteredNav.map((item) => {
            const active = isItemActive(pathname, item);

            if (collapsed) {
              return (
                <div key={item.name}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        onClick={onNavClick}
                        className={cn(
                          "flex items-center justify-center rounded-lg p-2 transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground/70 hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.name}</TooltipContent>
                  </Tooltip>
                </div>
              );
            }

            return (
              <div key={item.name}>
                <Link
                  href={item.href}
                  onClick={onNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70 hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{item.name}</span>
                  {active && item.children && (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Link>

                {/* Show grouped children when parent is active */}
                {active && item.children && (
                  <div className="ml-6 mt-1.5 mb-1 flex flex-col border-l-2 border-primary/20 pl-3">
                    {item.children.map((group, gi) => (
                      <div key={group.label ?? gi}>
                        {group.label && (
                          <div className="mb-1.5 mt-4 px-3">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {group.label}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          {group.items.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={onNavClick}
                              className={cn(
                                "rounded-md px-3 py-1.5 text-sm transition-colors",
                                isChildActive(pathname, child, item.href)
                                  ? "bg-muted font-medium text-foreground"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              {child.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Settings link at bottom */}
      <div className={cn("border-t border-border", collapsed ? "p-2" : "p-3")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                onClick={onNavClick}
                className={cn(
                  "flex items-center justify-center rounded-lg p-2 transition-colors",
                  pathname === "/settings"
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground"
                )}
              >
                <Settings className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Account
            </span>
            <Link
              href="/settings"
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/settings"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:bg-muted hover:text-foreground"
              )}
            >
              <Settings className="h-5 w-5" />
              Settings
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
