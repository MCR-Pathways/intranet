import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";
import { InductionPlaceholder } from "@/components/induction/induction-placeholder";
import { Scale } from "lucide-react";

export default async function KeyPoliciesPage() {
  const { isCompleted } = await getInductionItemStatus("policies");

  return (
    <InductionItemPage
      itemId="policies"
      title="Read Key Policies"
      description="Review and acknowledge key company policies"
      type="document"
      category="Getting Started"
      isCompleted={isCompleted}
    >
      <InductionPlaceholder
        icon={Scale}
        accent="light-blue"
        heading="Key Policies"
        intro="Policy documents will be available here soon. You will need to read and understand these key company policies."
        listLabel="Policies to review will include:"
        items={[
          "Code of Conduct",
          "Data Protection Policy",
          "Safeguarding Policy",
          "Health and Safety Policy",
          "Equal Opportunities Policy",
          "Whistleblowing Policy",
        ]}
      />
    </InductionItemPage>
  );
}
