import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";

export default async function KeyPoliciesPage() {
  const { isCompleted, userId } = await getInductionItemStatus("policies");

  return (
    <InductionItemPage
      itemId="policies"
      title="Read Key Policies"
      description="Review and acknowledge key company policies"
      type="document"
      category="Getting Started"
      isCompleted={isCompleted}
      userId={userId}
    >
      <div className="prose prose-sm max-w-none">
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Key Policies</h3>
          <p className="text-muted-foreground mb-4">
            Policy documents will be available here soon. You will need to read
            and understand these key company policies.
          </p>
          <div className="space-y-3 text-left text-sm text-muted-foreground max-w-md mx-auto">
            <p>Policies to review will include:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Code of Conduct</li>
              <li>Data Protection Policy</li>
              <li>Safeguarding Policy</li>
              <li>Health and Safety Policy</li>
              <li>Equal Opportunities Policy</li>
              <li>Whistleblowing Policy</li>
            </ul>
          </div>
        </div>
      </div>
    </InductionItemPage>
  );
}
