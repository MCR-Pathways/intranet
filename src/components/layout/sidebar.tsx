"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Home,
  User,
  GraduationCap,
  MapPin,
  Settings,
  ChevronRight,
  ClipboardList,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import { isHRAdminEffective, isLDAdminEffective, isSystemsAdminEffective, isContentEditorEffective } from "@/lib/auth-helpers";
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

interface NavigationResult {
  mainNav: NavItem[];
  adminItem: NavItem | null;
}

function getNavigation(
  isHRAdmin: boolean,
  isLDAdmin: boolean,
  isSystemsAdmin: boolean,
  canEditResources: boolean,
  userType: UserType,
): NavigationResult {
  const isStaff = userType === "staff";
  const hasAnyAdmin = isHRAdmin || isLDAdmin || isSystemsAdmin;

  // Home — all users
  const mainNav: NavItem[] = [
    {
      name: "Home",
      href: "/intranet",
      icon: Home,
      module: "intranet",
    },
  ];

  // Resources — all users (top-level knowledge base)
  mainNav.push({
    name: "Resources",
    href: "/resources",
    icon: BookOpen,
    module: "intranet",
  });

  // Me — staff only (personal HR items)
  if (isStaff) {
    mainNav.push({
      name: "Me",
      href: "/hr/profile",
      icon: User,
      module: "hr",
      children: [
        {
          label: null,
          items: [
            { name: "My Profile", href: "/hr/profile" },
            { name: "Leave", href: "/hr/leave" },
            { name: "Assets", href: "/hr/assets" },
            { name: "Flexible Working", href: "/hr/flexible-working" },
            { name: "My Team", href: "/hr/team" },
          ],
        },
      ],
    });
  }

  // Learning — staff + coordinators
  const learningChildren: NavGroup[] = [
    {
      label: null,
      items: [
        { name: "Catalogue", href: "/learning/courses" },
        { name: "Compliance", href: "/learning/courses?category=compliance" },
        { name: "Upskilling", href: "/learning/courses?category=upskilling" },
        { name: "Tool Shed", href: "/learning/tool-shed" },
      ],
    },
  ];

  mainNav.push({
    name: "Learning",
    href: "/learning",
    icon: GraduationCap,
    module: "learning",
    children: learningChildren,
  });

  // Location — staff only
  if (isStaff) {
    mainNav.push({
      name: "Location",
      href: "/sign-in",
      icon: MapPin,
      module: "sign-in",
    });
  }

  // Admin link — single dashboard link for admins
  let adminItem: NavItem | null = null;
  if (hasAnyAdmin) {
    // HR admins + systems admins → HR dashboard
    // L&D-only admins → L&D admin courses
    const adminHref = (isHRAdmin || isSystemsAdmin) ? "/hr" : "/learning/admin/courses";
    adminItem = {
      name: "Admin",
      href: adminHref,
      icon: ShieldCheck,
      module: null,
    };
  }

  return { mainNav, adminItem };
}

// Modules restricted to internal staff only (not external PCs)
const internalOnlyModules = new Set(["hr", "sign-in"]);

// =============================================
// HELPERS
// =============================================

function isItemActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true;
  // Try child paths first (precise match), then fall back to prefix matching.
  // The Me/Admin /hr prefix conflict is safe because Admin uses exact match
  // in the utility zone and doesn't go through isItemActive.
  if (item.children) {
    const childMatch = item.children.some((group) =>
      group.items.some(
        (child) =>
          pathname === child.href || pathname.startsWith(child.href + "/")
      )
    );
    if (childMatch) return true;
  }
  return pathname.startsWith(item.href + "/");
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
    // new_user types see an empty sidebar during induction — by design,
    // the proxy redirects them to /intranet/induction before they see the sidebar
    if (profile.user_type !== "staff") return false;
    // External staff can't access internal-only modules (HR, Sign-In)
    if (profile.is_external && internalOnlyModules.has(module)) return false;
    return true;
  };

  const hrAdmin = isHRAdminEffective(profile);
  const ldAdmin = isLDAdminEffective(profile);
  const systemsAdmin = isSystemsAdminEffective(profile);
  const contentEditor = isContentEditorEffective(profile);
  const canEditResources = hrAdmin || contentEditor;

  const { mainNav, adminItem } = getNavigation(hrAdmin, ldAdmin, systemsAdmin, canEditResources, profile?.user_type ?? "new_user");
  const filteredNav = mainNav.filter(
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
              className="mb-4 flex items-center gap-3 rounded-lg bg-mcr-orange/10 px-3 py-3 text-sm font-medium text-mcr-orange transition-colors hover:bg-mcr-orange/20"
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
                  className="mb-4 flex items-center justify-center rounded-lg bg-mcr-orange/10 p-2 text-mcr-orange transition-colors hover:bg-mcr-orange/20"
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

      {/* Utility zone: Admin + Settings */}
      <div className={cn("border-t border-border", collapsed ? "p-2" : "p-3")}>
        {collapsed ? (
          <div className="flex flex-col gap-2">
            {adminItem && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={adminItem.href}
                    onClick={onNavClick}
                    className={cn(
                      "flex items-center justify-center rounded-lg p-2 transition-colors",
                      pathname === adminItem.href
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/70 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <adminItem.icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Admin</TooltipContent>
              </Tooltip>
            )}
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
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {adminItem && (
              <Link
                href={adminItem.href}
                onClick={onNavClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname === adminItem.href
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground"
                )}
              >
                <adminItem.icon className="h-5 w-5" />
                Admin
              </Link>
            )}
            <span className="px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
