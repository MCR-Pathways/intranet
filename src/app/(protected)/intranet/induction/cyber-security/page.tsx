import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";
import { InductionPlaceholder } from "@/components/induction/induction-placeholder";
import { Lock } from "lucide-react";

export default async function CyberSecurityPage() {
  const { isCompleted } = await getInductionItemStatus("cyber_security");

  return (
    <InductionItemPage
      itemId="cyber_security"
      title="Cyber Security Training"
      description="Complete the cyber security awareness course"
      type="course"
      category="Compliance Training"
      isCompleted={isCompleted}
    >
      <InductionPlaceholder
        icon={Lock}
        accent="orange"
        heading="Cyber Security Awareness Training"
        intro="Course content will be available here soon. This mandatory training covers cyber security best practices to keep you and the organisation safe."
        listLabel="This course will cover:"
        items={[
          "Recognising phishing emails and scams",
          "Password security and multi-factor authentication",
          "Safe browsing and email practices",
          "Protecting sensitive information",
          "Social engineering awareness",
          "Reporting security incidents",
        ]}
      />
    </InductionItemPage>
  );
}
