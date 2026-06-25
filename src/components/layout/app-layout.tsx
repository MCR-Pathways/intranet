"use client";

import { useState, useCallback, useSyncExternalStore, useEffect } from "react";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";
import { getCentreColumnCSS } from "@/lib/layout";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database.types";
import type { InboxRow } from "@/types/notification";

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
  initialInboxRows?: InboxRow[];
}

export function AppLayout({ children, user, profile, initialInboxRows }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isCollapsed = useSyncExternalStore(subscribeSidebar, getSidebarSnapshot, getSidebarServerSnapshot);

  // Close the mobile menu on Escape. The backdrop click is mouse-only, so this
  // is the keyboard route out — without it there's no way to dismiss the menu
  // short of selecting a nav item.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMobileMenuOpen]);

  // Centre-column width for the current route. Exposed via the
  // `--centre-column` CSS variable so page content can match a
  // constrained width. Source of truth: src/lib/layout.ts.
  const pathname = usePathname();
  const centreColumnCSS = getCentreColumnCSS(pathname);
  const mainStyle = centreColumnCSS
    ? ({ "--centre-column": centreColumnCSS } as CSSProperties)
    : undefined;

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
        initialInboxRows={initialInboxRows}
        onMenuToggle={toggleMobileMenu}
        onSidebarToggle={toggleSidebar}
        isCollapsed={isCollapsed}
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
            {/* Decorative scrim, hidden from the a11y tree. Click-to-close is a mouse
                convenience; keyboard users dismiss with Escape (see effect above) or by
                choosing a nav item. aria-hidden keeps it out of the interaction surface. */}
            <div
              aria-hidden="true"
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
          style={mainStyle}
        >
          <div className="container max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-[var(--centre-column,100%)]">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
