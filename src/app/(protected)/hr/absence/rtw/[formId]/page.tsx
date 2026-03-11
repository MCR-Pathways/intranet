import { getCurrentUser } from "@/lib/auth";
import { RTW_FORM_SELECT, ABSENCE_RECORD_SELECT } from "@/lib/hr";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { RTWConfirmationContent } from "./rtw-confirmation-content";
import { PageHeader } from "@/components/layout/page-header";
import type { ReturnToWorkForm, AbsenceRecord } from "@/types/hr";

export default async function RTWConfirmationPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the RTW form (RLS ensures only the employee, their manager, or HR can see it)
  const { data: rawForm, error: formError } = await supabase
    .from("return_to_work_forms")
    .select(RTW_FORM_SELECT)
    .eq("id", formId)
    .single();

  if (formError || !rawForm) {
    notFound();
  }

  const form = rawForm as unknown as ReturnToWorkForm;

  // Fetch the absence record
  const { data: rawAbsence } = await supabase
    .from("absence_records")
    .select(ABSENCE_RECORD_SELECT)
    .eq("id", form.absence_record_id)
    .single();

  const absence = rawAbsence as unknown as AbsenceRecord | null;

  const isEmployee = user.id === form.employee_id;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Return-to-Work Form"
        subtitle="Review and confirm your return-to-work discussion"
        breadcrumbs={[
          { label: "Admin", href: "/hr" },
          { label: "Absence", href: "/hr/absence" },
          { label: "RTW Form" },
        ]}
      />

      <RTWConfirmationContent
        form={form}
        absence={absence}
        isEmployee={isEmployee}
      />
    </div>
  );
}
