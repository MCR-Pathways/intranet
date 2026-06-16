import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";
import { InductionPlaceholder } from "@/components/induction/induction-placeholder";
import { HeartHandshake } from "lucide-react";

export default async function EDITrainingPage() {
  const { isCompleted } = await getInductionItemStatus("edi");

  return (
    <InductionItemPage
      itemId="edi"
      title="EDI Training"
      description="Complete the equality, diversity and inclusion course"
      type="course"
      category="Compliance Training"
      isCompleted={isCompleted}
    >
      <InductionPlaceholder
        icon={HeartHandshake}
        accent="teal"
        heading="Equality, Diversity & Inclusion Training"
        intro="Course content will be available here soon. This mandatory training covers EDI principles and how they apply at MCR Pathways."
        listLabel="This course will cover:"
        items={[
          "Understanding equality, diversity and inclusion",
          "Protected characteristics",
          "Unconscious bias awareness",
          "Creating an inclusive workplace",
          "Addressing discrimination and harassment",
          "MCR Pathways' commitment to EDI",
        ]}
      />
    </InductionItemPage>
  );
}
