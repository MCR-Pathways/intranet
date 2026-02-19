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
