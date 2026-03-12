"use server";

import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

export async function markInductionItemComplete(
  itemId: string
): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase.from("induction_progress").insert({
    user_id: user.id,
    item_id: itemId,
  });

  if (error) {
    // Unique constraint violation means item is already completed — not an error
    if (error.code === "23505") {
      revalidatePath("/intranet/induction");
      redirect("/intranet/induction");
    }
    logger.error("Failed to mark induction item complete", { error });
    return { success: false, error: "Failed to complete induction item. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  revalidatePath("/intranet/induction");
  redirect("/intranet/induction");
}

/**
 * Finalise induction: mark the user's profile as active with a completed timestamp.
 * Called from InductionChecklist after all items are done.
 */
export async function completeInduction(): Promise<{ success: boolean; error: string | null }> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Server-side verification: ensure all 9 induction items are completed.
  // Items are defined in src/components/induction/induction-checklist.tsx.
  const REQUIRED_ITEM_COUNT = 9;
  const { count } = await supabase
    .from("induction_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!count || count < REQUIRED_ITEM_COUNT) {
    return { success: false, error: "Not all induction items have been completed" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      induction_completed_at: new Date().toISOString(),
      status: "active",
    })
    .eq("id", user.id);

  if (error) {
    logger.error("Failed to complete induction", { error });
    return { success: false, error: "Failed to complete induction. Please contact Helpdesk@mcrpathways.org with details of the error if the issue persists." };
  }

  // Refresh session so the JWT picks up the new claims from the DB trigger.
  // Non-blocking: if this fails, the user keeps stale claims until the next
  // natural token refresh (~1 hour) but induction completion itself succeeded.
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    logger.warn("Failed to refresh session after induction completion", {
      userId: user.id,
      error: refreshError.message,
    });
  }

  revalidatePath("/intranet/induction");
  revalidatePath("/", "layout");
  redirect("/intranet");
}
