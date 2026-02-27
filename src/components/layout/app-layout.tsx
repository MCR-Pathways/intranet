"use client";

import { useState, useCallback } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database.types";
import type { NotificationData } from "@/types/notification";

const SIDEBAR_STORAGE_KEY = "sidebar-collapsed";

interface AppLayoutProps {
  children: React.ReactNode;
  user: User;
  profile: Profile | null;
  needsSignIn?: boolean;
  initialNotifications?: NotificationData[];
}

export function AppLayout({ children, user, profile, needsSignIn, initialNotifications }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  });

  const toggleSidebar = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={user}
        profile={profile}
        needsSignIn={needsSignIn}
        initialNotifications={initialNotifications}
        onMenuToggle={toggleMobileMenu}
        onSidebarToggle={toggleSidebar}
      />

      <div className="flex">
        {/* Desktop sidebar */}
        <Sidebar
          profile={profile}
          collapsed={isCollapsed}
          className="hidden md:flex fixed left-0 top-16 h-[calc(100vh-4rem)]"
        />

        {/* Mobile sidebar overlay */}
        {isMobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <Sidebar
              profile={profile}
              className="fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] md:hidden animate-slide-in-left"
              onNavClick={() => setIsMobileMenuOpen(false)}
            />
          </>
        )}

        {/* Main content */}
        <main
          className={cn(
            "flex-1 min-h-[calc(100vh-4rem)] transition-[margin] duration-200",
            isCollapsed ? "md:ml-16" : "md:ml-64"
          )}
        >
          <div className="container max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
