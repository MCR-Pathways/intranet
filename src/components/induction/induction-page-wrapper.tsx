import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Server-side helper to check auth and fetch induction item completion status.
 * Returns the completion status for a given item ID.
 */
export async function getInductionItemStatus(itemId: string) {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Check if this item is already completed
  const { data: progress } = await supabase
    .from("induction_progress")
    .select("id")
    .eq("user_id", user.id)
    .eq("item_id", itemId)
    .single();

  return {
    isCompleted: !!progress,
  };
}
