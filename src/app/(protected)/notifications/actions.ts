"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

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
    logger.error("Failed to fetch notifications", { error });
    return { notifications: [], error: "Failed to fetch notifications. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
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
    logger.error("Failed to mark notification as read", { error });
    return { success: false, error: "Failed to update notification. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/", "layout");
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
    logger.error("Failed to mark all notifications as read", { error });
    return { success: false, error: "Failed to update notifications. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/", "layout");
  return { success: true, error: null };
}
