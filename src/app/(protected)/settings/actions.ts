"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

export async function updateEmailPreference(
  emailType: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("email_preferences")
    .upsert(
      {
        user_id: user.id,
        email_type: emailType,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,email_type" }
    );

  if (error) {
    logger.error("Failed to update email preference", {
      emailType,
      enabled,
      error: error.message,
    });
    return { success: false, error: "Failed to update preference" };
  }

  revalidatePath("/settings");
  return { success: true };
}
