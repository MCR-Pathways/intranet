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
import { Settings, LogOut, User, Menu } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Profile } from "@/types/database.types";

interface HeaderProps {
  user: SupabaseUser;
  profile: Profile | null;
  onMobileMenuToggle?: () => void;
}

export function Header({ user, profile, onMobileMenuToggle }: HeaderProps) {
  const isStaff = profile?.user_type === "staff";

  const handleSignOut = async () => {
    try {
      await signOutAction();
    } catch (error) {
      // redirect() throws NEXT_REDIRECT — this is expected
      const err = error as Error;
      if (err?.message?.includes("NEXT_REDIRECT")) {
        return;
      }
      console.error("Error signing out:", error);
      window.location.href = "/login";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = profile?.preferred_name || profile?.full_name || "User";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Left side - Logo and mobile menu */}
        <div className="flex items-center gap-4">
          {onMobileMenuToggle && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onMobileMenuToggle}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          )}
          <Link href="/dashboard" className="flex items-center">
            <Image
              src="/MCR_LOGO-1.svg"
              alt="MCR Pathways"
              width={120}
              height={36}
              priority
            />
          </Link>
        </div>

        {/* Right side - Notifications and user menu */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <NotificationBell />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={profile?.avatar_url || undefined}
                    alt={displayName}
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground">
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
              {isStaff && (
                <DropdownMenuItem asChild>
                  <Link href="/hr/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onSelect={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
