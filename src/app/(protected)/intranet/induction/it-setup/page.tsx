import { getInductionItemStatus } from "@/components/induction/induction-page-wrapper";
import { InductionItemPage } from "@/components/induction/induction-item-page";

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
      <div className="prose prose-sm max-w-none">
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">IT Account Setup</h3>
          <p className="text-muted-foreground mb-4">
            Please ensure the following IT accounts are set up and working
            correctly. Contact IT support if you need help.
          </p>
          <div className="space-y-3 text-left text-sm text-muted-foreground max-w-md mx-auto">
            <p>Checklist:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>MCR Pathways email account is active</li>
              <li>Google Workspace access (Drive, Calendar, Meet)</li>
              <li>Intranet login is working (you&apos;re here!)</li>
              <li>Any team-specific tools or platforms</li>
              <li>VPN access if required for your role</li>
            </ul>
            <p className="mt-4 text-xs">
              If you need IT support, contact:{" "}
              <span className="font-medium">it@mcrpathways.org</span>
            </p>
          </div>
        </div>
      </div>
    </InductionItemPage>
  );
}
