"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function markInductionItemComplete(itemId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
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
    throw new Error(error.message);
  }

  revalidatePath("/intranet/induction");
  redirect("/intranet/induction");
}
