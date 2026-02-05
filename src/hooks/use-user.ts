"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchProfile } from "@/lib/auth/profile";
import type { User } from "@supabase/supabase-js";
import type { Profile, UserType } from "@/types/database.types";

interface UseUserReturn {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  error: Error | null;
  isStaff: boolean;
  isHRAdmin: boolean;
  isLineManager: boolean;
  hasModuleAccess: (module: string) => boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const refreshProfile = async () => {
    if (!user) return;
    const profileData = await fetchProfile(supabase, user.id);
    if (profileData) {
      setProfile(profileData);
    }
  };

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        setUser(authUser);

        if (authUser) {
          const profileData = await fetchProfile(supabase, authUser.id);
          setProfile(profileData);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to get user"));
      } finally {
        setIsLoading(false);
      }
    };

    getUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        const profileData = await fetchProfile(supabase, session.user.id);
        setProfile(profileData);
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const isStaff = profile?.user_type === "staff";
  const isHRAdmin = profile?.is_hr_admin ?? false;
  const isLineManager = profile?.is_line_manager ?? false;

  const hasModuleAccess = (module: string): boolean => {
    if (!profile) return false;

    const userType = profile.user_type;
    const moduleAccess: Record<string, UserType[]> = {
      hr: ["staff"],
      "sign-in": ["staff"],
      learning: ["staff", "pathways_coordinator"],
      intranet: ["staff", "pathways_coordinator"],
      induction: ["staff", "pathways_coordinator", "new_user"],
    };

    const allowedTypes = moduleAccess[module];
    if (!allowedTypes) return true; // Unknown module, allow access

    return allowedTypes.includes(userType);
  };

  return {
    user,
    profile,
    isLoading,
    error,
    isStaff,
    isHRAdmin,
    isLineManager,
    hasModuleAccess,
    signOut,
    refreshProfile,
  };
}
