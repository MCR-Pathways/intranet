"use client";

import Image from "next/image";
import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { GlobalSearch } from "@/components/layout/global-search";
import { Settings, LogOut, User, Menu } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Profile } from "@/types/database.types";
import { cn, getInitials, getAvatarColour, filterAvatarUrl } from "@/lib/utils";
import { CENTRE_COLUMN_WIDTHS } from "@/lib/layout";
import { logger } from "@/lib/logger";
import type { InboxRow } from "@/types/notification";
import { DestructiveMenuItem } from "@/components/ui/destructive-menu-item";

interface HeaderProps {
  user: SupabaseUser;
  profile: Profile | null;
  initialInboxRows?: InboxRow[];
  onMenuToggle?: () => void;
  onSidebarToggle?: () => void;
  // Mirrors AppLayout's sidebar state so the centred search bar tracks the
  // same offset as <main> and stays lined up over the feed when the sidebar
  // collapses.
  isCollapsed?: boolean;
}

export function Header({
  user,
  profile,
  initialInboxRows,
  onMenuToggle,
  onSidebarToggle,
  isCollapsed = false,
}: HeaderProps) {
  const isInternalStaff = profile?.user_type === "staff" && !profile?.is_external;

  const handleSignOut = async () => {
    try {
      await signOutAction();
    } catch (error) {
      // redirect() throws NEXT_REDIRECT — this is expected
      const err = error as Error;
      if (err?.message?.includes("NEXT_REDIRECT")) {
        return;
      }
      logger.error("Error signing out", { error });
      window.location.href = "/login";
    }
  };

  const displayName = profile?.preferred_name || profile?.full_name || "User";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
      <div className="relative flex h-16 items-center">
        {/* Left — hamburger(s) + logo. Absolute so the centred bar's zone spans
            the full content width (an in-flow left cluster would shove it). */}
        <div className="absolute left-0 flex items-center">
          {onSidebarToggle && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex ml-3"
              onClick={onSidebarToggle}
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
            >
              <Menu />
            </Button>
          )}
          {onMenuToggle && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-4 md:hidden"
              onClick={onMenuToggle}
              aria-label="Toggle menu"
              title="Toggle menu"
            >
              <Menu />
            </Button>
          )}
          <Link href="/intranet" className="flex items-center ml-4">
            <Image
              src="/MCR_LOGO-1.svg"
              alt="MCR Pathways"
              width={120}
              height={36}
              priority
            />
          </Link>
        </div>

        {/* Centre — search bar. Mirrors <main>'s offset (md:ml-64 / md:ml-16) +
            container so it centres over the feed column, on every route and in
            both sidebar states. Hidden below md: the absolute logo + corner
            clusters would overlap it, and the mobile bar is a deferred pass.
            See docs/search-bar-redesign.md. */}
        <div
          className={cn(
            "hidden min-w-0 flex-1 transition-[margin] duration-200 md:block",
            isCollapsed ? "md:ml-16" : "md:ml-64"
          )}
        >
          <div className="container mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
            <div
              className="mx-auto"
              style={{ maxWidth: `${CENTRE_COLUMN_WIDTHS.intranet}px` }}
            >
              <GlobalSearch />
            </div>
          </div>
        </div>

        {/* Right — notifications + user menu. Absolute so it doesn't shift the
            centred bar off the feed's centre. */}
        <div className="absolute right-0 flex items-center gap-2 pr-4 md:pr-6">
          <div className="relative">
            <NotificationBell initialRows={initialInboxRows} />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative rounded-full"
                aria-label={`User menu for ${displayName}`}
              >
                <Avatar>
                  <AvatarImage
                    src={filterAvatarUrl(profile?.avatar_url)}
                    alt={displayName}
                  />
                  <AvatarFallback className={cn(getAvatarColour(displayName).bg, getAvatarColour(displayName).fg)}>
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {displayName}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                  {profile?.job_title && (
                    <p className="text-xs leading-none text-muted-foreground">
                      {profile.job_title}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isInternalStaff && (
                <DropdownMenuItem asChild>
                  <Link href="/hr/profile" className="cursor-pointer">
                    <User />
                    My profile
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DestructiveMenuItem
                className="cursor-pointer"
                onSelect={handleSignOut}
              >
                <LogOut />
                Sign out
              </DestructiveMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
