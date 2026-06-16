import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";
import { InductionPlaceholder } from "@/components/induction/induction-placeholder";
import { HardHat } from "lucide-react";

export default async function HealthSafetyPage() {
  const { isCompleted } = await getInductionItemStatus("health_safety");

  return (
    <InductionItemPage
      itemId="health_safety"
      title="Health & Safety Training"
      description="Complete the mandatory health and safety course"
      type="course"
      category="Compliance Training"
      isCompleted={isCompleted}
    >
      <InductionPlaceholder
        icon={HardHat}
        accent="wine"
        heading="Health & Safety Training"
        intro="Course content will be available here soon. This mandatory training will cover health and safety practices at MCR Pathways."
        listLabel="This course will cover:"
        items={[
          "Workplace hazards and risks",
          "Fire safety and evacuation procedures",
          "First aid awareness",
          "Display screen equipment (DSE)",
          "Reporting incidents and near misses",
          "Working from home safely",
        ]}
      />
    </InductionItemPage>
  );
}
