"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { DailyBanner } from "@/components/sign-in/daily-banner";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database.types";
import type { NotificationData } from "@/types/notification";

const SIDEBAR_STORAGE_KEY = "sidebar-collapsed";
const SIDEBAR_TOGGLE_EVENT = "mcr-sidebar-toggle";

// ─── useSyncExternalStore for localStorage ──────────────────────────
// Bridges localStorage (an external store) with React's rendering cycle
// to avoid the hydration mismatch caused by reading localStorage in a
// lazy useState initialiser. useSyncExternalStore lets React:
//   1. Render the server snapshot (false = expanded) during SSR/hydration
//   2. Subscribe to changes via a namespaced CustomEvent
//   3. Read the true client value from localStorage after hydration

/**
 * Subscribe to sidebar state changes. Called by useSyncExternalStore.
 * Listens to both the in-page CustomEvent and the browser `storage` event
 * so the sidebar stays in sync across multiple tabs.
 */
function subscribeSidebar(callback: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_STORAGE_KEY || event.key === null) {
      callback();
    }
  };

  window.addEventListener(SIDEBAR_TOGGLE_EVENT, callback);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(SIDEBAR_TOGGLE_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

/** Read the current sidebar state from localStorage. */
function getSidebarSnapshot() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Server snapshot — always expanded (false) to match initial HTML. */
function getSidebarServerSnapshot() {
  return false;
}

// ─── Layout Component ───────────────────────────────────────────────

interface AppLayoutProps {
  children: React.ReactNode;
  user: User;
  profile: Profile | null;
  initialNotifications?: NotificationData[];
  dailyBannerType?: string | null;
}

export function AppLayout({ children, user, profile, initialNotifications, dailyBannerType }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isCollapsed = useSyncExternalStore(subscribeSidebar, getSidebarSnapshot, getSidebarServerSnapshot);

  const toggleSidebar = useCallback(() => {
    try {
      const next = !getSidebarSnapshot();
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      window.dispatchEvent(new CustomEvent(SIDEBAR_TOGGLE_EVENT));
    } catch {
      // localStorage unavailable — toggle is a no-op
    }
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={user}
        profile={profile}
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
            {dailyBannerType && (
              <DailyBanner type={dailyBannerType as "office_not_confirmed" | "no_schedule"} />
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
