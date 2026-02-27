"use server";

import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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
    return { success: false, error: error.message };
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
    return { success: false, error: error.message };
  }

  // Refresh session so the JWT picks up the new claims from the DB trigger
  await supabase.auth.refreshSession();

  revalidatePath("/intranet/induction");
  revalidatePath("/", "layout");
  redirect("/intranet");
}
