import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";

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
      <div className="prose prose-sm max-w-none">
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">
            Health &amp; Safety Training
          </h3>
          <p className="text-muted-foreground mb-4">
            Course content will be available here soon. This mandatory training
            will cover health and safety practices at MCR Pathways.
          </p>
          <div className="space-y-3 text-left text-sm text-muted-foreground max-w-md mx-auto">
            <p>This course will cover:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Workplace hazards and risks</li>
              <li>Fire safety and evacuation procedures</li>
              <li>First aid awareness</li>
              <li>Display screen equipment (DSE)</li>
              <li>Reporting incidents and near misses</li>
              <li>Working from home safely</li>
            </ul>
          </div>
        </div>
      </div>
    </InductionItemPage>
  );
}
