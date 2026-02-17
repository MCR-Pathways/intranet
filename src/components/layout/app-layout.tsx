"use client";

import { useState } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database.types";

interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

interface AppLayoutProps {
  children: React.ReactNode;
  user: User;
  profile: Profile | null;
  needsSignIn?: boolean;
  initialNotifications?: NotificationData[];
}

export function AppLayout({ children, user, profile, needsSignIn, initialNotifications }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={user}
        profile={profile}
        needsSignIn={needsSignIn}
        initialNotifications={initialNotifications}
        onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="flex">
        {/* Desktop sidebar */}
        <Sidebar
          profile={profile}
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
            "flex-1 min-h-[calc(100vh-4rem)]",
            "md:ml-64" // Account for sidebar width on desktop
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
