import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InductionChecklist } from "@/components/induction/induction-checklist";

export default async function InductionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // If induction is already completed, redirect to dashboard
  if (profile?.induction_completed_at) {
    redirect("/dashboard");
  }

  // Fetch completed induction items from the database
  const { data: progressData } = await supabase
    .from("induction_progress")
    .select("item_id")
    .eq("user_id", user.id);

  const completedItemIds = progressData?.map((p) => p.item_id) || [];
  const displayName = profile?.preferred_name || profile?.full_name || "there";

  return (
    <InductionChecklist
      displayName={displayName}
      completedItemIds={completedItemIds}
      userId={user.id}
    />
  );
}
