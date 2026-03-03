import { redirect } from "next/navigation";

/**
 * Backward-compatible redirect — the team calendar now lives
 * as a tab within the Leave page.
 */
export default function CalendarPage() {
  redirect("/hr/leave?tab=calendar");
}
