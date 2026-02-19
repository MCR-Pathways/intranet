import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InductionChecklist } from "@/components/induction/induction-checklist";

export default async function InductionPage() {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // If induction is already completed, redirect to dashboard
  if (profile?.induction_completed_at) {
    redirect("/intranet");
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
