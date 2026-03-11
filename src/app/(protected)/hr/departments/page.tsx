import { getCurrentUser, isHRAdminEffective } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DepartmentManagementContent } from "@/components/hr/department-management-content";

export default async function DepartmentsPage() {
  const { supabase, user, profile } = await getCurrentUser();

  if (!user || !profile) {
    redirect("/login");
  }

  if (!isHRAdminEffective(profile)) {
    redirect("/hr");
  }

  // Fetch all departments (including inactive) for management
  const { data: departmentRows } = await supabase
    .from("departments")
    .select("id, slug, name, colour, sort_order, is_active, created_at, updated_at")
    .order("sort_order");

  // Get staff counts per department
  const { data: staffCounts } = await supabase
    .from("profiles")
    .select("department")
    .eq("status", "active")
    .not("department", "is", null);

  // Build count map
  const countMap: Record<string, number> = {};
  for (const row of staffCounts ?? []) {
    const dept = row.department as string;
    countMap[dept] = (countMap[dept] ?? 0) + 1;
  }

  const departments = (departmentRows ?? []).map((d) => ({
    id: d.id as string,
    slug: d.slug as string,
    name: d.name as string,
    colour: d.colour as string,
    sort_order: d.sort_order as number,
    is_active: d.is_active as boolean,
    staff_count: countMap[d.slug as string] ?? 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        subtitle="Manage organisational departments"
        breadcrumbs={[
          { label: "Admin", href: "/hr" },
          { label: "Departments" },
        ]}
      />
      <DepartmentManagementContent departments={departments} />
    </div>
  );
}
