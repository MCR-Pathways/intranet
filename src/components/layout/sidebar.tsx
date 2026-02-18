"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Newspaper,
  Users,
  GraduationCap,
  MapPin,
  Settings,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import type { Profile, UserType } from "@/types/database.types";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  module: string | null;
  children?: { name: string; href: string }[];
}

function getNavigation(isHRAdmin: boolean, isLDAdmin: boolean): NavItem[] {
  const hrChildren = [
    { name: "My Profile", href: "/hr/profile" },
    { name: "Org Chart", href: "/hr/org-chart" },
    { name: "Leave", href: "/hr/leave" },
    { name: "Calendar", href: "/hr/calendar" },
    { name: "My Team", href: "/hr/team" },
    ...(isHRAdmin
      ? [{ name: "User Management", href: "/hr/users" }]
      : []),
  ];

  return [
    {
      name: "Intranet",
      href: "/intranet",
      icon: Newspaper,
      module: "intranet",
      children: [
        { name: "News Feed", href: "/intranet" },
        { name: "Weekly Round Up", href: "/intranet/weekly-roundup" },
        { name: "Guides", href: "/intranet/guides" },
        { name: "Policies", href: "/intranet/policies" },
        { name: "Surveys", href: "/intranet/surveys" },
      ],
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
      children: [
        { name: "My Courses", href: "/learning" },
        { name: "Compliance", href: "/learning/courses?category=compliance" },
        { name: "Upskilling", href: "/learning/courses?category=upskilling" },
        { name: "Tool Shed", href: "/learning/tool-shed" },
        ...(isLDAdmin
          ? [
              { name: "Course Management", href: "/learning/admin/courses" },
              { name: "Reports", href: "/learning/admin/reports" },
            ]
          : []),
      ],
    },
    { name: "Sign In", href: "/sign-in", icon: MapPin, module: "sign-in" },
  ];
}

const moduleAccess: Record<string, UserType[]> = {
  hr: ["staff"],
  "sign-in": ["staff"],
  learning: ["staff", "pathways_coordinator"],
  intranet: ["staff", "pathways_coordinator"],
};

interface SidebarProps {
  profile: Profile | null;
  className?: string;
  onNavClick?: () => void;
}

export function Sidebar({ profile, className, onNavClick }: SidebarProps) {
  const pathname = usePathname();

  const hasModuleAccess = (module: string): boolean => {
    if (!profile) return false;
    const allowedTypes = moduleAccess[module];
    if (!allowedTypes) return true;
    return allowedTypes.includes(profile.user_type);
  };

  const navigation = getNavigation(profile?.is_hr_admin ?? false, profile?.is_ld_admin ?? false);

  // Filter navigation based on user permissions
  const filteredNav = navigation.filter(
    (item) => !item.module || hasModuleAccess(item.module)
  );

  // Check if user needs induction
  const needsInduction =
    profile && !profile.induction_completed_at;

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r border-border bg-card",
        className
      )}
    >
      <ScrollArea className="flex-1 py-4">
        <nav className="flex flex-col gap-1 px-3">
          {/* Induction prompt for new users */}
          {needsInduction && (
            <Link
              href="/intranet/induction"
              onClick={onNavClick}
              className="mb-4 flex items-center gap-3 rounded-lg bg-secondary/10 px-3 py-3 text-sm font-medium text-secondary transition-colors hover:bg-secondary/20"
            >
              <ClipboardList className="h-5 w-5" />
              <div>
                <p className="font-semibold">Complete Induction</p>
                <p className="text-xs opacity-80">Required to continue</p>
              </div>
            </Link>
          )}

          {filteredNav.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/") ||
              item.children?.some(
                (child) =>
                  pathname === child.href ||
                  pathname.startsWith(child.href + "/")
              );

            return (
              <div key={item.name}>
                <Link
                  href={item.href}
                  onClick={onNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70 hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{item.name}</span>
                  {isActive && item.children && (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Link>

                {/* Show children when parent is active */}
                {isActive && item.children && (
                  <div className="ml-6 mt-1 flex flex-col gap-1 border-l border-border pl-3">
                    {item.children.map((child) => {
                      const isChildActive =
                        pathname === child.href ||
                        (child.href !== item.href &&
                          pathname.startsWith(child.href + "/"));

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onNavClick}
                          className={cn(
                            "rounded-md px-3 py-1.5 text-sm transition-colors",
                            isChildActive
                              ? "bg-muted font-medium text-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          {child.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Settings link at bottom */}
      <div className="border-t border-border p-3">
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
    </aside>
  );
}
