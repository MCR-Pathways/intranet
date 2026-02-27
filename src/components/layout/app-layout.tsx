"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database.types";
import type { NotificationData } from "@/types/notification";

const SIDEBAR_STORAGE_KEY = "sidebar-collapsed";

// ─── useSyncExternalStore for localStorage ──────────────────────────
// SSR-safe: getServerSnapshot returns false (expanded), avoiding hydration mismatch.
// Client subscribes to a custom "sidebar-toggle" event for cross-component sync.

function subscribeSidebar(callback: () => void) {
  window.addEventListener("sidebar-toggle", callback);
  return () => window.removeEventListener("sidebar-toggle", callback);
}

function getSidebarSnapshot() {
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

function getSidebarServerSnapshot() {
  return false;
}

// ─── Layout Component ───────────────────────────────────────────────

interface AppLayoutProps {
  children: React.ReactNode;
  user: User;
  profile: Profile | null;
  needsSignIn?: boolean;
  initialNotifications?: NotificationData[];
}

export function AppLayout({ children, user, profile, needsSignIn, initialNotifications }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isCollapsed = useSyncExternalStore(subscribeSidebar, getSidebarSnapshot, getSidebarServerSnapshot);

  const toggleSidebar = useCallback(() => {
    const next = !getSidebarSnapshot();
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    window.dispatchEvent(new Event("sidebar-toggle"));
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
