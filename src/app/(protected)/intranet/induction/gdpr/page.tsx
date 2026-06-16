import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";
import { InductionPlaceholder } from "@/components/induction/induction-placeholder";
import { ShieldCheck } from "lucide-react";

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
      <InductionPlaceholder
        icon={ShieldCheck}
        accent="green"
        heading="GDPR & Data Protection Training"
        intro="Course content will be available here soon. This mandatory training covers how to handle personal data responsibly and comply with GDPR."
        listLabel="This course will cover:"
        items={[
          "What is GDPR and why it matters",
          "Key data protection principles",
          "Handling personal and sensitive data",
          "Data subject rights",
          "Reporting data breaches",
          "MCR Pathways data handling procedures",
        ]}
      />
    </InductionItemPage>
  );
}
