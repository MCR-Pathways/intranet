import { createServiceClient } from "@/lib/supabase/service";

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a notification for a user using the service role client.
 * The notifications table has no INSERT RLS policy for regular users,
 * so the service role is required to create notifications.
 */
export async function createNotification(params: CreateNotificationParams) {
  const supabase = createServiceClient();

  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link ?? null,
    metadata: params.metadata ?? null,
  });

  return { error };
}

/**
 * Delete all sign-in reminder notifications for a user (read or unread).
 * Called when the user records their first sign-in of the day.
 * Once the user has signed in, these notifications are fulfilled and
 * should be removed regardless of whether they were previously read.
 */
export async function dismissSignInReminders(userId: string) {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", userId)
    .eq("type", "sign_in_reminder");

  return { error };
}
