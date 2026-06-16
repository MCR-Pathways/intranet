import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";
import { InductionPlaceholder } from "@/components/induction/induction-placeholder";
import { Mail } from "lucide-react";

export default async function EmailSignaturePage() {
  const { isCompleted } = await getInductionItemStatus("email_signature");

  return (
    <InductionItemPage
      itemId="email_signature"
      title="Set Up Email Signature"
      description="Configure your MCR Pathways email signature"
      type="task"
      category="IT Setup"
      isCompleted={isCompleted}
    >
      <InductionPlaceholder
        icon={Mail}
        accent="pink"
        heading="Email Signature Setup"
        intro="Please set up your MCR Pathways email signature using the template below. Instructions for adding this to your Gmail account will be provided."
        listLabel="Your email signature should include:"
        items={[
          "Your full name",
          "Your job title",
          "MCR Pathways",
          "Your contact phone number",
          "The MCR Pathways logo",
          "Standard disclaimer text",
        ]}
        note="Email signature template and instructions will be provided here soon."
      />
    </InductionItemPage>
  );
}
