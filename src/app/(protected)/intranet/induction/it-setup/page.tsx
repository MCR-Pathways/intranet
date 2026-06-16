import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";
import { InductionPlaceholder } from "@/components/induction/induction-placeholder";
import { Laptop } from "lucide-react";

export default async function ITSetupPage() {
  const { isCompleted } = await getInductionItemStatus("it_setup");

  return (
    <InductionItemPage
      itemId="it_setup"
      title="IT Account Setup"
      description="Ensure your IT accounts are properly configured"
      type="task"
      category="IT Setup"
      isCompleted={isCompleted}
    >
      <InductionPlaceholder
        icon={Laptop}
        accent="light-blue"
        heading="IT Account Setup"
        intro="Please ensure the following IT accounts are set up and working correctly. Contact IT support if you need help."
        listLabel="Checklist:"
        items={[
          "MCR Pathways email account is active",
          "Google Workspace access (Drive, Calendar, Meet)",
          "Intranet login is working (you're here!)",
          "Any team-specific tools or platforms",
          "VPN access if required for your role",
        ]}
        note={
          <>
            If you need IT support, contact:{" "}
            <span className="font-medium">it@mcrpathways.org</span>
          </>
        }
      />
    </InductionItemPage>
  );
}
