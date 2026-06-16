import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";
import { InductionPlaceholder } from "@/components/induction/induction-placeholder";
import { BookOpen } from "lucide-react";

export default async function WelcomePackPage() {
  const { isCompleted } = await getInductionItemStatus("welcome");

  return (
    <InductionItemPage
      itemId="welcome"
      title="Read Welcome Pack"
      description="Review the MCR Pathways welcome documentation"
      type="document"
      category="Getting Started"
      isCompleted={isCompleted}
    >
      <InductionPlaceholder
        icon={BookOpen}
        accent="teal"
        heading="Welcome Pack"
        intro="Welcome pack content will be available here soon. This will include an introduction to MCR Pathways, our mission, values, and everything you need to know to get started."
        listLabel="The welcome pack will cover:"
        items={[
          "About MCR Pathways",
          "Our mission and values",
          "Organisation structure",
          "Key contacts",
          "Working hours and expectations",
          "Support available to you",
        ]}
      />
    </InductionItemPage>
  );
}
