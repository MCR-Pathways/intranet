import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";

export default async function GDPRTrainingPage() {
  const { isCompleted } = await getInductionItemStatus("gdpr");

  return (
    <InductionItemPage
      itemId="gdpr"
      title="GDPR Training"
      description="Complete the data protection awareness course"
      type="course"
      category="Compliance Training"
      isCompleted={isCompleted}
    >
      <div className="prose prose-sm max-w-none">
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">
            GDPR &amp; Data Protection Training
          </h3>
          <p className="text-muted-foreground mb-4">
            Course content will be available here soon. This mandatory training
            covers how to handle personal data responsibly and comply with GDPR.
          </p>
          <div className="space-y-3 text-left text-sm text-muted-foreground max-w-md mx-auto">
            <p>This course will cover:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>What is GDPR and why it matters</li>
              <li>Key data protection principles</li>
              <li>Handling personal and sensitive data</li>
              <li>Data subject rights</li>
              <li>Reporting data breaches</li>
              <li>MCR Pathways data handling procedures</li>
            </ul>
          </div>
        </div>
      </div>
    </InductionItemPage>
  );
}
