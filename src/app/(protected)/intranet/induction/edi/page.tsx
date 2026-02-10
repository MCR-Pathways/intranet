import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";

export default async function EDITrainingPage() {
  const { isCompleted, userId } = await getInductionItemStatus("edi");

  return (
    <InductionItemPage
      itemId="edi"
      title="EDI Training"
      description="Complete the equality, diversity and inclusion course"
      type="course"
      category="Compliance Training"
      isCompleted={isCompleted}
      userId={userId}
    >
      <div className="prose prose-sm max-w-none">
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">
            Equality, Diversity &amp; Inclusion Training
          </h3>
          <p className="text-muted-foreground mb-4">
            Course content will be available here soon. This mandatory training
            covers EDI principles and how they apply at MCR Pathways.
          </p>
          <div className="space-y-3 text-left text-sm text-muted-foreground max-w-md mx-auto">
            <p>This course will cover:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Understanding equality, diversity and inclusion</li>
              <li>Protected characteristics</li>
              <li>Unconscious bias awareness</li>
              <li>Creating an inclusive workplace</li>
              <li>Addressing discrimination and harassment</li>
              <li>MCR Pathways&apos; commitment to EDI</li>
            </ul>
          </div>
        </div>
      </div>
    </InductionItemPage>
  );
}
