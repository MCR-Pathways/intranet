import { getCurrentUser, isHRAdminEffective } from "@/lib/auth";
import { redirect } from "next/navigation";
import { KeyDatesDashboard } from "@/components/hr/key-dates-dashboard";

const KEY_DATE_SELECT =
  "id, profile_id, date_type, due_date, title, description, is_completed, completed_at, profiles!profile_id(full_name)";

export default async function KeyDatesPage() {
  const { supabase, profile } = await getCurrentUser();
  if (!isHRAdminEffective(profile)) {
    redirect("/hr");
  }

  const [{ data: rawDates }, { data: employees }] = await Promise.all([
    supabase
      .from("key_dates")
      .select(KEY_DATE_SELECT)
      .order("due_date"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("status", "active")
      .order("full_name"),
  ]);

  const keyDates = (rawDates ?? []).map((kd) => {
    const p = kd.profiles as unknown as { full_name: string } | null;
    return {
      id: kd.id as string,
      profile_id: kd.profile_id as string,
      date_type: kd.date_type as string,
      due_date: kd.due_date as string,
      title: kd.title as string,
      description: kd.description as string | null,
      is_completed: kd.is_completed as boolean,
      employee_name: p?.full_name ?? "Unknown",
    };
  });

  const employeeList = (employees ?? []).map((e) => ({
    id: e.id as string,
    full_name: e.full_name as string,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Key Dates</h1>
        <p className="text-muted-foreground mt-1">
          Track probation ends, contract renewals, and other important dates
        </p>
      </div>
      <KeyDatesDashboard keyDates={keyDates} employees={employeeList} />
    </div>
  );
}
