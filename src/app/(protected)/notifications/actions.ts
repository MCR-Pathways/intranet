"use server";

import { getCurrentUser } from "@/lib/auth";

export async function getNotifications() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { notifications: [], error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, type, title, message, link, is_read, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return { notifications: [], error: error.message };
  }

  return { notifications: data || [], error: null };
}

export async function markNotificationRead(
  notificationId: string
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

export async function markAllNotificationsRead(): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}
